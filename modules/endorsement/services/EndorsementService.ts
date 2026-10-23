import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type {
  EndorsementEntity,
  EndorsementSignerEntity,
  EndorsementSourceType,
} from "../domain/entities/Endorsement";
import {
  canAccessDocument,
  canCancel,
  canSign,
  isExpired,
  isFullySigned,
  UNDECIDED_SIGNER_STATUSES,
} from "../domain/endorsement-rules";
import type {
  EndorsementListFilters,
  IEndorsementRepository,
} from "../domain/ports/IEndorsementRepository";
import { EndorsementRepository } from "../repositories/EndorsementRepository";
import { buildNextEndorsementNumber } from "./endorsement-number";
import { generateSignerToken, hashSignerToken } from "./endorsement-token";
import { EndorsementPdfService } from "./EndorsementPdfService";
import { EndorsementStorageService } from "./EndorsementStorageService";

/**
 * Alur hidup surat pengesahan.
 *
 * Token short link dibuat di sini dan **hanya dikembalikan sekali** — yang
 * tersimpan cuma sidik jarinya. Karena itu link tidak bisa "dilihat lagi"
 * belakangan; mengirim ulang berarti menerbitkan token baru sekaligus
 * menggugurkan yang lama (`reissueSignerLink`).
 *
 * Setiap perubahan status memakai transisi bersyarat di repository: dua
 * permintaan yang berbarengan (klik ganda, dua penanda tangan terakhir
 * menandatangani bersamaan) tidak bisa sama-sama lolos.
 */

/** Masa berlaku bawaan bila pembuat surat tidak menentukannya. */
const DEFAULT_EXPIRY_DAYS = 30;

export interface SignerLink {
  signerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** Terisi bila penanda tangan karyawan internal — ia menandatangani lewat aplikasi. */
  userId: string | null;
  token: string;
}

export interface CreateEndorsementCommand {
  title: string;
  description?: string;
  sourceType: EndorsementSourceType;
  sourceId?: string;
  fileName: string;
  fileBuffer: Buffer;
  expiresAt?: Date;
  signers: Array<{
    name: string;
    role?: string;
    email?: string;
    phone?: string;
    userId?: string;
  }>;
}

export interface SignerRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

/** Surat beserta penanda tangan yang sedang bertindak atasnya. */
export interface ResolvedSigner {
  endorsement: EndorsementEntity;
  signer: EndorsementSignerEntity;
}

const SIGNING_CLOSED_MESSAGE =
  "Surat ini sudah tidak bisa dipakai untuk menandatangani";

function buildDefaultExpiry(now: Date = new Date()): Date {
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + DEFAULT_EXPIRY_DAYS);

  return expiry;
}

function toSignerLink(
  signer: EndorsementSignerEntity,
  token: string,
): SignerLink {
  return {
    signerId: signer.id,
    name: signer.name,
    email: signer.email,
    phone: signer.phone,
    userId: signer.userId,
    token,
  };
}

/**
 * Umumkan bahwa surat sah agar modul lain (mis. legal) bisa menindaklanjuti.
 * Kegagalan publish tidak boleh menggagalkan finalisasi yang sudah tersimpan.
 */
async function publishCompleted(
  endorsement: EndorsementEntity,
  signedFileHash: string,
): Promise<void> {
  try {
    const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
    await eventBus.publish(EVENT_NAMES.ENDORSEMENT_COMPLETED, {
      endorsementId: endorsement.id,
      sourceType: endorsement.sourceType,
      sourceId: endorsement.sourceId,
      signedFileHash,
      tenantId: endorsement.tenantId ?? undefined,
    });
  } catch (error) {
    logger.error(`[Endorsement] Gagal publish surat sah ${endorsement.id}:`, error);
  }
}

function invalidState(message: string): AppError {
  return new AppError(message, 409, "INVALID_STATE");
}

export class EndorsementService {
  constructor(
    private readonly repository: IEndorsementRepository = new EndorsementRepository(),
    private readonly storage: EndorsementStorageService = new EndorsementStorageService(),
    private readonly pdf: EndorsementPdfService = new EndorsementPdfService(),
  ) {}

  /** Daftar surat untuk halaman admin. */
  list(filters: EndorsementListFilters) {
    return this.repository.findMany(filters);
  }

  /** Ambil satu surat; 404 bila tidak ada (atau milik tenant lain). */
  async getById(id: string): Promise<EndorsementEntity> {
    const endorsement = await this.repository.findById(id);
    if (!endorsement) {
      throw new AppError("Surat pengesahan tidak ditemukan", 404, "NOT_FOUND");
    }

    return endorsement;
  }

  /**
   * Buat surat beserta token tiap penanda tangan.
   *
   * Berkas diunggah lebih dulu memakai id sementara supaya kunci objek sudah
   * final sebelum baris dibuat; kalau pembuatan baris gagal, berkasnya dibuang
   * agar tidak meninggalkan objek yatim di penyimpanan.
   */
  async create(
    command: CreateEndorsementCommand,
    createdById: string,
  ): Promise<{ endorsement: EndorsementEntity; links: SignerLink[] }> {
    const { tenantId } = await getTenantIdFromContext();
    const endorsementId = crypto.randomUUID();

    const { key, hash } = await this.storage.saveSourcePdf({
      tenantId,
      endorsementId,
      fileName: command.fileName,
      buffer: command.fileBuffer,
    });

    const lastNumber = await this.repository.findLastNumber(tenantId);
    const tokens = command.signers.map(() => generateSignerToken());

    try {
      const endorsement = await this.repository.create({
        number: buildNextEndorsementNumber(lastNumber),
        title: command.title,
        description: command.description,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        sourceFileKey: key,
        sourceFileName: command.fileName,
        sourceFileHash: hash,
        expiresAt: command.expiresAt ?? buildDefaultExpiry(),
        createdById,
        tenantId,
        signers: command.signers.map((signer, index) => ({
          ...signer,
          tokenHash: hashSignerToken(tokens[index]!),
          order: index,
        })),
      });

      await this.repository.recordEvent({
        endorsementId: endorsement.id,
        type: "CREATED",
        metadata: { signerCount: command.signers.length },
        tenantId,
      });

      return {
        endorsement,
        links: endorsement.signers.map((signer, index) =>
          toSignerLink(signer, tokens[index]!),
        ),
      };
    } catch (error) {
      await this.storage.removeAll([key]);
      throw error;
    }
  }

  /** Tandai surat sudah dikirim ke para penanda tangan. */
  async markSent(id: string): Promise<void> {
    const endorsement = await this.getById(id);
    const isSent = await this.repository.transitionStatus(
      id,
      ["DRAFT"],
      "SENT",
    );
    if (!isSent) {
      throw invalidState("Hanya surat berstatus draf yang bisa dikirim");
    }

    await this.repository.recordEvent({
      endorsementId: id,
      type: "SENT",
      tenantId: endorsement.tenantId,
    });
  }

  /** Batalkan surat yang belum mencapai status akhir. */
  async cancel(id: string, reason: string): Promise<void> {
    const endorsement = await this.getById(id);
    const cancelError = invalidState(
      endorsement.status === "COMPLETED"
        ? "Surat yang sudah sah tidak bisa dibatalkan"
        : "Surat ini sudah tidak aktif",
    );
    if (!canCancel(endorsement.status)) throw cancelError;

    const isCancelled = await this.repository.transitionStatus(
      id,
      ["DRAFT", "SENT"],
      "CANCELLED",
      { cancelledAt: new Date(), cancelReason: reason },
    );
    if (!isCancelled) throw cancelError;

    await this.repository.recordEvent({
      endorsementId: id,
      type: "CANCELLED",
      metadata: { reason },
      tenantId: endorsement.tenantId,
    });
  }

  /**
   * Terbitkan tautan baru untuk satu penanda tangan.
   *
   * Token lama langsung gugur karena sidik jarinya ditimpa. Dipakai saat
   * tautan awal tidak sampai (mis. WhatsApp belum tersambung) atau hilang.
   */
  async reissueSignerLink(
    endorsementId: string,
    signerId: string,
  ): Promise<SignerLink> {
    const endorsement = await this.getById(endorsementId);
    const signer = endorsement.signers.find((item) => item.id === signerId);
    if (!signer) {
      throw new AppError("Penanda tangan tidak ditemukan", 404, "NOT_FOUND");
    }

    if (!canSign(endorsement, signer)) {
      throw invalidState(
        "Tautan hanya bisa diterbitkan ulang untuk penanda tangan yang belum memutuskan pada surat yang masih berjalan",
      );
    }

    const token = generateSignerToken();
    await this.repository.updateSignerTokenHash(
      signer.id,
      hashSignerToken(token),
    );
    await this.repository.recordEvent({
      endorsementId,
      signerId: signer.id,
      type: "LINK_REISSUED",
      tenantId: endorsement.tenantId,
    });

    return toSignerLink(signer, token);
  }

  /** Ambil surat berdasarkan token short link. */
  async resolveByToken(token: string): Promise<ResolvedSigner> {
    const found = await this.repository.findByTokenHash(hashSignerToken(token));
    if (!found) {
      throw new AppError("Tautan tidak dikenali", 404, "NOT_FOUND");
    }

    const signer = found.endorsement.signers.find(
      (candidate) => candidate.id === found.signerId,
    );
    if (!signer) {
      throw new AppError("Tautan tidak dikenali", 404, "NOT_FOUND");
    }

    return { endorsement: found.endorsement, signer };
  }

  /**
   * Ambil surat yang menunjuk user internal ini sebagai penanda tangan.
   * Surat yang tidak menunjuknya diperlakukan seperti tidak ada (404), supaya
   * keberadaan surat orang lain tidak bocor.
   */
  async resolveForUser(
    endorsementId: string,
    userId: string,
  ): Promise<ResolvedSigner> {
    const endorsement = await this.repository.findById(endorsementId);
    const signer = endorsement?.signers.find((item) => item.userId === userId);
    if (!endorsement || !signer) {
      throw new AppError("Surat pengesahan tidak ditemukan", 404, "NOT_FOUND");
    }

    return { endorsement, signer };
  }

  /** Catat bahwa penanda tangan membuka tautannya (sekali, selama surat berjalan). */
  async markViewed(token: string, context: SignerRequestContext) {
    return this.markSignerViewed(await this.resolveByToken(token), context);
  }

  /** Catat bahwa penanda tangan membuka surat; hanya sekali, selama surat berjalan. */
  async markSignerViewed(
    resolved: ResolvedSigner,
    context: SignerRequestContext,
  ): Promise<ResolvedSigner> {
    const { endorsement, signer } = resolved;
    if (signer.status !== "PENDING" || endorsement.status !== "SENT") {
      return resolved;
    }

    const isViewed = await this.repository.transitionSigner(
      signer.id,
      ["PENDING"],
      { status: "VIEWED", viewedAt: new Date(), ...context },
    );
    if (isViewed) {
      await this.repository.recordEvent({
        endorsementId: endorsement.id,
        signerId: signer.id,
        type: "VIEWED",
        ...context,
        tenantId: endorsement.tenantId,
      });
    }

    return resolved;
  }

  /** Dokumen untuk pemegang tautan; lihat `readDocumentFor`. */
  async getDocumentForSigner(
    token: string,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    const { endorsement } = await this.resolveByToken(token);

    return this.readDocumentFor(endorsement);
  }

  /**
   * Dokumen untuk penanda tangan: PDF gabungan bila sudah sah, dokumen asal
   * selama surat berjalan. Surat yang dibatalkan atau kedaluwarsa tidak lagi
   * bisa dibuka.
   */
  async readDocumentFor(
    endorsement: EndorsementEntity,
  ): Promise<{ buffer: Buffer; fileName: string }> {
    if (!canAccessDocument(endorsement)) {
      throw new AppError("Surat pengesahan tidak ditemukan", 404, "NOT_FOUND");
    }

    const key = endorsement.signedFileKey ?? endorsement.sourceFileKey;

    return {
      buffer: await this.storage.read(key),
      fileName: endorsement.sourceFileName,
    };
  }

  /** Bubuhkan tanda tangan lewat tautan; lihat `signAs`. */
  async sign(
    token: string,
    signatureBuffer: Buffer,
    context: SignerRequestContext,
  ): Promise<{ endorsement: EndorsementEntity; completed: boolean }> {
    return this.signAs(
      await this.resolveByToken(token),
      signatureBuffer,
      context,
    );
  }

  /**
   * Bubuhkan tanda tangan seorang penanda tangan yang sudah teridentifikasi
   * (lewat token tautan atau sesi aplikasi).
   *
   * Mengembalikan `completed` supaya klien tahu surat sudah sah. Penanda
   * tangan terakhir sekaligus memicu penyusunan PDF gabungan; kalau langkah
   * itu gagal, tanda tangannya tetap tersimpan dan cron mengulang finalisasi.
   */
  async signAs(
    { endorsement, signer }: ResolvedSigner,
    signatureBuffer: Buffer,
    context: SignerRequestContext,
  ): Promise<{ endorsement: EndorsementEntity; completed: boolean }> {
    if (!canSign(endorsement, signer)) {
      throw invalidState(
        isExpired(endorsement)
          ? "Masa berlaku surat sudah habis"
          : SIGNING_CLOSED_MESSAGE,
      );
    }

    const signatureKey = await this.storage.saveSignature({
      tenantId: endorsement.tenantId,
      endorsementId: endorsement.id,
      signerId: signer.id,
      buffer: signatureBuffer,
    });

    const isSigned = await this.repository.transitionSigner(
      signer.id,
      UNDECIDED_SIGNER_STATUSES,
      { status: "SIGNED", signatureKey, signedAt: new Date(), ...context },
    );
    if (!isSigned) throw invalidState(SIGNING_CLOSED_MESSAGE);

    await this.repository.recordEvent({
      endorsementId: endorsement.id,
      signerId: signer.id,
      type: "SIGNED",
      ...context,
      tenantId: endorsement.tenantId,
    });

    const completed = await this.tryFinalize(endorsement.id);

    return { endorsement: await this.getById(endorsement.id), completed };
  }

  /** Tolak mengesahkan lewat tautan; lihat `declineAs`. */
  async decline(
    token: string,
    reason: string,
    context: SignerRequestContext,
  ): Promise<EndorsementEntity> {
    return this.declineAs(await this.resolveByToken(token), reason, context);
  }

  /** Tolak mengesahkan; satu penolakan menggugurkan surat. */
  async declineAs(
    { endorsement, signer }: ResolvedSigner,
    reason: string,
    context: SignerRequestContext,
  ): Promise<EndorsementEntity> {
    if (!canSign(endorsement, signer)) {
      throw invalidState(SIGNING_CLOSED_MESSAGE);
    }

    const isDeclined = await this.repository.transitionSigner(
      signer.id,
      UNDECIDED_SIGNER_STATUSES,
      {
        status: "DECLINED",
        declinedAt: new Date(),
        declineReason: reason,
        ...context,
      },
    );
    if (!isDeclined) throw invalidState(SIGNING_CLOSED_MESSAGE);

    await this.repository.recordEvent({
      endorsementId: endorsement.id,
      signerId: signer.id,
      type: "DECLINED",
      metadata: { reason },
      ...context,
      tenantId: endorsement.tenantId,
    });

    // Menandatangani sebagian tidak berarti apa-apa, jadi surat langsung gugur.
    await this.repository.transitionStatus(endorsement.id, ["SENT"], "CANCELLED", {
      cancelledAt: new Date(),
      cancelReason: `Ditolak oleh ${signer.name}: ${reason}`,
    });

    return this.getById(endorsement.id);
  }

  /**
   * Ulangi finalisasi surat yang sudah ditandatangani semua tetapi belum
   * berstatus sah — mis. penyusunan PDF gagal saat tanda tangan terakhir.
   * Dipanggil cron; kegagalan satu surat tidak menghentikan yang lain.
   */
  async finalizePending(): Promise<number> {
    const ids = await this.repository.findFullySignedOpenIds();
    let finalizedCount = 0;

    for (const id of ids) {
      if (await this.tryFinalize(id)) finalizedCount++;
    }

    return finalizedCount;
  }

  /** Tandai surat yang lewat masa berlaku; dipanggil cron. */
  async expireOverdue(now: Date = new Date()): Promise<number> {
    const overdue = await this.repository.findExpired(now);
    let expiredCount = 0;

    for (const { id, tenantId } of overdue) {
      const isExpiredNow = await this.repository.transitionStatus(
        id,
        ["SENT"],
        "EXPIRED",
      );
      if (!isExpiredNow) continue;

      expiredCount++;
      await this.repository.recordEvent({
        endorsementId: id,
        type: "EXPIRED",
        tenantId,
      });
    }

    if (expiredCount > 0) {
      logger.info(`[Endorsement] ${expiredCount} surat ditandai kedaluwarsa`);
    }

    return expiredCount;
  }

  /** Isi berkas untuk disajikan lewat rute server. */
  readFile(key: string) {
    return this.storage.read(key);
  }

  /**
   * Finalisasi yang tidak pernah melempar: tanda tangan yang sudah tersimpan
   * tidak boleh tampak gagal hanya karena PDF gabungan belum bisa disusun.
   */
  private async tryFinalize(id: string): Promise<boolean> {
    try {
      return await this.finalizeIfComplete(id);
    } catch (error) {
      logger.error(`[Endorsement] Finalisasi ${id} gagal, diulang cron:`, error);
      return false;
    }
  }

  /**
   * Naikkan surat ke COMPLETED bila semua penanda tangan sudah tanda tangan.
   *
   * Berkas gabungan disusun sebelum status naik: kalau dibalik, surat sempat
   * terlihat sah padahal PDF finalnya belum ada. Bila permintaan lain menang
   * lebih dulu, berkas yang baru disusun dibuang supaya sidik jari yang
   * tersimpan selalu cocok dengan berkas yang dirujuk.
   */
  private async finalizeIfComplete(id: string): Promise<boolean> {
    const endorsement = await this.getById(id);
    if (endorsement.status !== "SENT" || !isFullySigned(endorsement.signers)) {
      return false;
    }

    const signed = await this.pdf.buildSignedPdf(endorsement);
    const isCompleted = await this.repository.transitionStatus(
      id,
      ["SENT"],
      "COMPLETED",
      {
        completedAt: new Date(),
        signedFileKey: signed.key,
        signedFileHash: signed.hash,
      },
    );

    if (!isCompleted) {
      await this.storage.removeAll([signed.key]);
      return false;
    }

    await this.repository.recordEvent({
      endorsementId: id,
      type: "COMPLETED",
      metadata: { signedFileHash: signed.hash },
      tenantId: endorsement.tenantId,
    });
    await publishCompleted(endorsement, signed.hash);

    return true;
  }
}
