import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type {
  EndorsementEntity,
  EndorsementSourceType,
} from "../domain/entities/Endorsement";
import {
  canSign,
  isExpired,
  resolveEndorsementStatus,
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
 * menggugurkan yang lama.
 */

/** Masa berlaku bawaan bila pembuat surat tidak menentukannya. */
const DEFAULT_EXPIRY_DAYS = 30;

export interface SignerLink {
  signerId: string;
  name: string;
  email: string | null;
  phone: string | null;
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

function buildDefaultExpiry(now: Date = new Date()): Date {
  const expiry = new Date(now);
  expiry.setDate(expiry.getDate() + DEFAULT_EXPIRY_DAYS);

  return expiry;
}

export class EndorsementService {
  constructor(
    private readonly repository: IEndorsementRepository = new EndorsementRepository(),
    private readonly storage: EndorsementStorageService = new EndorsementStorageService(),
    private readonly pdf: EndorsementPdfService = new EndorsementPdfService(),
  ) {}

  list(filters: EndorsementListFilters) {
    return this.repository.findMany(filters);
  }

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
        links: endorsement.signers.map((signer, index) => ({
          signerId: signer.id,
          name: signer.name,
          email: signer.email,
          phone: signer.phone,
          token: tokens[index]!,
        })),
      };
    } catch (error) {
      await this.storage.removeAll([key]);
      throw error;
    }
  }

  /** Tandai surat sudah dikirim ke para penanda tangan. */
  async markSent(id: string): Promise<void> {
    const endorsement = await this.getById(id);
    if (endorsement.status !== "DRAFT") {
      throw new AppError(
        "Hanya surat berstatus draf yang bisa dikirim",
        409,
        "INVALID_STATE",
      );
    }

    await this.repository.updateStatus(id, "SENT");
    await this.repository.recordEvent({
      endorsementId: id,
      type: "SENT",
      tenantId: endorsement.tenantId,
    });
  }

  async cancel(id: string, reason: string): Promise<void> {
    const endorsement = await this.getById(id);
    if (endorsement.status === "COMPLETED") {
      throw new AppError(
        "Surat yang sudah sah tidak bisa dibatalkan",
        409,
        "INVALID_STATE",
      );
    }

    await this.repository.updateStatus(id, "CANCELLED", {
      cancelledAt: new Date(),
      cancelReason: reason,
    });
    await this.repository.recordEvent({
      endorsementId: id,
      type: "CANCELLED",
      metadata: { reason },
      tenantId: endorsement.tenantId,
    });
  }

  /** Ambil surat berdasarkan token short link. */
  async resolveByToken(token: string) {
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

  async markViewed(token: string, context: SignerRequestContext) {
    const { endorsement, signer } = await this.resolveByToken(token);
    if (signer.status !== "PENDING") return { endorsement, signer };

    await this.repository.updateSigner(signer.id, {
      status: "VIEWED",
      viewedAt: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    await this.repository.recordEvent({
      endorsementId: endorsement.id,
      signerId: signer.id,
      type: "VIEWED",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      tenantId: endorsement.tenantId,
    });

    return { endorsement, signer };
  }

  /**
   * Bubuhkan tanda tangan.
   *
   * Mengembalikan `completed` supaya pemanggil tahu kapan harus merangkai PDF
   * gabungan — perangkaian ditaruh di luar agar service ini tidak bergantung
   * pada pustaka PDF.
   */
  async sign(
    token: string,
    signatureBuffer: Buffer,
    context: SignerRequestContext,
  ): Promise<{ endorsement: EndorsementEntity; completed: boolean }> {
    const { endorsement, signer } = await this.resolveByToken(token);

    if (!canSign(endorsement, signer)) {
      throw new AppError(
        isExpired(endorsement)
          ? "Masa berlaku surat sudah habis"
          : "Tautan ini sudah tidak bisa dipakai menandatangani",
        409,
        "INVALID_STATE",
      );
    }

    const signatureKey = await this.storage.saveSignature({
      tenantId: endorsement.tenantId,
      endorsementId: endorsement.id,
      signerId: signer.id,
      buffer: signatureBuffer,
    });

    await this.repository.updateSigner(signer.id, {
      status: "SIGNED",
      signatureKey,
      signedAt: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    await this.repository.recordEvent({
      endorsementId: endorsement.id,
      signerId: signer.id,
      type: "SIGNED",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      tenantId: endorsement.tenantId,
    });

    const updated = await this.getById(endorsement.id);
    const nextStatus = resolveEndorsementStatus(
      updated.status,
      updated.signers,
    );

    if (nextStatus !== "COMPLETED") {
      return { endorsement: updated, completed: false };
    }

    // Berkas gabungan disusun sebelum status naik ke COMPLETED. Kalau urutannya
    // dibalik, surat sempat terlihat sah padahal PDF finalnya belum ada, dan
    // pemegang tautan menerima dokumen asal tanpa lembar pengesahan.
    const signed = await this.pdf.buildSignedPdf(updated);

    await this.repository.updateStatus(updated.id, "COMPLETED", {
      completedAt: new Date(),
      signedFileKey: signed.key,
      signedFileHash: signed.hash,
    });
    await this.repository.recordEvent({
      endorsementId: updated.id,
      type: "COMPLETED",
      metadata: { signedFileHash: signed.hash },
      tenantId: updated.tenantId,
    });

    return { endorsement: await this.getById(updated.id), completed: true };
  }

  async decline(
    token: string,
    reason: string,
    context: SignerRequestContext,
  ): Promise<EndorsementEntity> {
    const { endorsement, signer } = await this.resolveByToken(token);

    if (!canSign(endorsement, signer)) {
      throw new AppError(
        "Tautan ini sudah tidak bisa dipakai",
        409,
        "INVALID_STATE",
      );
    }

    await this.repository.updateSigner(signer.id, {
      status: "DECLINED",
      declinedAt: new Date(),
      declineReason: reason,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    await this.repository.recordEvent({
      endorsementId: endorsement.id,
      signerId: signer.id,
      type: "DECLINED",
      metadata: { reason },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      tenantId: endorsement.tenantId,
    });

    // Satu penolakan menggugurkan surat: menandatangani sebagian tidak berarti.
    await this.repository.updateStatus(endorsement.id, "CANCELLED", {
      cancelledAt: new Date(),
      cancelReason: `Ditolak oleh ${signer.name}: ${reason}`,
    });

    return this.getById(endorsement.id);
  }

  /** Tandai surat yang lewat masa berlaku; dipanggil cron. */
  async expireOverdue(now: Date = new Date()): Promise<number> {
    const ids = await this.repository.findExpiredIds(now);

    for (const id of ids) {
      await this.repository.updateStatus(id, "EXPIRED");
      const endorsement = await this.repository.findById(id);
      await this.repository.recordEvent({
        endorsementId: id,
        type: "EXPIRED",
        tenantId: endorsement?.tenantId ?? null,
      });
    }

    if (ids.length > 0) {
      logger.info(`[Endorsement] ${ids.length} surat ditandai kedaluwarsa`);
    }

    return ids.length;
  }

  /** Isi berkas untuk disajikan lewat rute server. */
  readFile(key: string) {
    return this.storage.read(key);
  }
}
