import type { z } from "zod";
import { AppError } from "@/lib/errors";
import {
  EndorsementIssueService,
  EndorsementService,
  type endorsementSignerInputSchema,
  type IssueResult,
} from "@/modules/endorsement";
import type { LegalDocumentEntity } from "../domain/entities/LegalDocument";
import { isMonitored } from "../domain/legal-rules";
import type { ILegalRepository, LegalAccess } from "../domain/ports/ILegalRepository";
import { LegalRepository } from "../repositories/LegalRepository";
import type { CreateLegalDocumentPayload } from "../validators/legal.validator";
import { LegalDocumentService } from "./LegalDocumentService";
import { LegalStorageService } from "./LegalStorageService";

/**
 * Jembatan modul legal ↔ surat pengesahan.
 *
 * - Dokumen legal (PDF) bisa dikirim untuk ditandatangani; saat suratnya sah,
 *   berkas dokumen legal diganti dengan PDF final yang bertanda tangan.
 * - Surat pengesahan yang dibuat langsung dan sudah sah bisa diarsipkan ke
 *   Legal dalam satu langkah.
 *
 * Hanya memakai API publik modul endorsement; tindak lanjut "surat sah" datang
 * lewat event, bukan panggilan langsung dari modul endorsement.
 */

const PDF_CONTENT_TYPE = "application/pdf";
const LEGAL_SOURCE_TYPE = "LEGAL_DOCUMENT";
const FULL_ACCESS: LegalAccess = { canViewConfidential: true };

type SignerInput = z.infer<typeof endorsementSignerInputSchema>;

export interface SendForSignatureInput {
  title?: string;
  expiresAt?: Date;
  signers: SignerInput[];
}

/** Nama berkas versi sah: "kontrak.pdf" → "kontrak-sah.pdf". */
function signedFileName(fileName: string): string {
  return fileName.replace(/(\.pdf)?$/i, "-sah.pdf");
}

export class LegalSigningService {
  constructor(
    private readonly repository: ILegalRepository = new LegalRepository(),
    private readonly documents: LegalDocumentService = new LegalDocumentService(repository),
    private readonly storage: LegalStorageService = new LegalStorageService(),
    private readonly endorsements: EndorsementService = new EndorsementService(),
    private readonly issuer: EndorsementIssueService = new EndorsementIssueService(),
  ) {}

  /** Kirim berkas dokumen legal untuk ditandatangani lewat surat pengesahan. */
  async sendForSignature(
    documentId: string,
    input: SendForSignatureInput,
    context: { userId: string; access: LegalAccess },
  ): Promise<IssueResult> {
    const document = await this.documents.getById(documentId, context.access);
    await this.assertSendable(document);

    const result = await this.issuer.issue(
      {
        title: input.title ?? document.title,
        sourceType: LEGAL_SOURCE_TYPE,
        sourceId: document.id,
        fileName: document.fileName,
        fileBuffer: await this.storage.read(document.fileKey),
        expiresAt: input.expiresAt,
        signers: input.signers,
      },
      context.userId,
    );
    await this.repository.linkEndorsement(document.id, result.endorsement.id);

    return result;
  }

  /**
   * Terapkan PDF bertanda tangan ke dokumen legal asal surat. Dipanggil handler
   * event "surat sah"; idempoten — berkas yang sudah versi sah tidak diganti ulang.
   */
  async applySignedVersion(endorsementId: string): Promise<boolean> {
    const endorsement = await this.endorsements.getById(endorsementId);
    if (endorsement.sourceType !== LEGAL_SOURCE_TYPE || !endorsement.sourceId) {
      return false;
    }

    const document = await this.repository.findDocumentById(endorsement.sourceId, FULL_ACCESS);
    const isAlreadyApplied = document?.fileHash === endorsement.signedFileHash;
    if (!document || !endorsement.signedFileKey || isAlreadyApplied) return false;

    const file = await this.storage.save({
      tenantId: document.tenantId,
      documentId: document.id,
      upload: {
        buffer: await this.endorsements.readFile(endorsement.signedFileKey),
        fileName: signedFileName(document.fileName),
        contentType: PDF_CONTENT_TYPE,
      },
    });
    await this.repository.replaceFile(document.id, file);
    await this.repository.linkEndorsement(document.id, endorsement.id);

    return true;
  }

  /** Arsipkan surat pengesahan yang sudah sah sebagai dokumen legal baru. */
  async archiveEndorsement(
    endorsementId: string,
    payload: CreateLegalDocumentPayload,
    context: { userId: string; access: LegalAccess },
  ): Promise<LegalDocumentEntity> {
    const endorsement = await this.endorsements.getById(endorsementId);
    if (endorsement.status !== "COMPLETED" || !endorsement.signedFileKey) {
      throw new AppError("Hanya surat yang sudah sah yang bisa diarsipkan", 409, "INVALID_STATE");
    }
    if (await this.repository.findDocumentIdByEndorsement(endorsementId)) {
      throw new AppError("Surat ini sudah tersimpan di arsip Legal", 409, "DUPLICATE");
    }

    return this.documents.create(
      payload,
      {
        buffer: await this.endorsements.readFile(endorsement.signedFileKey),
        fileName: `${endorsement.number.replace(/\//g, "-")}-sah.pdf`,
        contentType: PDF_CONTENT_TYPE,
      },
      { ...context, endorsementId },
    );
  }

  /** Id dokumen legal yang mengarsipkan surat ini, bila ada. */
  findArchivedDocumentId(endorsementId: string): Promise<string | null> {
    return this.repository.findDocumentIdByEndorsement(endorsementId);
  }

  private async assertSendable(document: LegalDocumentEntity): Promise<void> {
    if (document.fileContentType !== PDF_CONTENT_TYPE) {
      throw new AppError("Hanya dokumen PDF yang bisa dikirim untuk ditandatangani", 400, "VALIDATION_ERROR");
    }
    if (!isMonitored(document)) {
      throw new AppError("Dokumen ini sudah diperpanjang atau diakhiri", 409, "INVALID_STATE");
    }
    if (!document.endorsementId) return;

    const current = await this.endorsements.getById(document.endorsementId);
    if (current.status === "SENT") {
      throw new AppError("Dokumen ini sedang dalam proses tanda tangan", 409, "INVALID_STATE");
    }
  }
}
