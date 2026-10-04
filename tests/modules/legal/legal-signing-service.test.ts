import { beforeEach, describe, expect, it, vi } from "vitest";
import { LegalSigningService } from "@/modules/legal/services/LegalSigningService";
import { buildLegalRepository, legalDocument } from "./legal-fixtures";

/**
 * Jembatan legal ↔ pengesahan: dokumen legal dikirim untuk ditandatangani dan
 * otomatis memakai PDF sah; surat sah bisa diarsipkan sekali saja.
 */

const ACCESS = { canViewConfidential: false };
const CONTEXT = { userId: "admin-1", access: ACCESS };

const endorsement = (over: Record<string, unknown> = {}) => ({
  id: "end-1",
  number: "PGS/202610/0007",
  status: "COMPLETED",
  sourceType: "LEGAL_DOCUMENT",
  sourceId: "doc-1",
  signedFileKey: "pengesahan/t/end-1/final.pdf",
  signedFileHash: "f".repeat(64),
  ...over,
});

let repository: ReturnType<typeof buildLegalRepository> & Record<string, ReturnType<typeof vi.fn>>;
let documents: { getById: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
let storage: { read: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
let endorsements: { getById: ReturnType<typeof vi.fn>; readFile: ReturnType<typeof vi.fn> };
let issuer: { issue: ReturnType<typeof vi.fn> };
let service: LegalSigningService;

beforeEach(() => {
  repository = {
    ...buildLegalRepository(),
    linkEndorsement: vi.fn(),
    replaceFile: vi.fn(),
    findDocumentIdByEndorsement: vi.fn().mockResolvedValue(null),
  };
  documents = { getById: vi.fn().mockResolvedValue(legalDocument()), create: vi.fn() };
  storage = {
    read: vi.fn().mockResolvedValue(Buffer.from("%PDF draf")),
    save: vi.fn().mockResolvedValue({
      fileKey: "legal/tenant-1/doc-1/pks-sah.pdf",
      fileName: "pks-sah.pdf",
      fileHash: "f".repeat(64),
      fileContentType: "application/pdf",
    }),
  };
  endorsements = {
    getById: vi.fn().mockResolvedValue(endorsement()),
    readFile: vi.fn().mockResolvedValue(Buffer.from("%PDF sah")),
  };
  issuer = {
    issue: vi.fn().mockResolvedValue({
      endorsement: { id: "end-9" },
      deliveries: [],
      links: [],
    }),
  };
  service = new LegalSigningService(
    repository as never,
    documents as never,
    storage as never,
    endorsements as never,
    issuer as never,
  );
});

const signers = [{ name: "Direktur", userId: "user-9" }];

describe("sendForSignature", () => {
  it("menerbitkan surat bersumber dokumen legal memakai berkasnya, lalu menautkan", async () => {
    await service.sendForSignature("doc-1", { signers }, CONTEXT);

    expect(issuer.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "PKS Reseller Sumber Jaya",
        sourceType: "LEGAL_DOCUMENT",
        sourceId: "doc-1",
        fileName: "pks.pdf",
        fileBuffer: Buffer.from("%PDF draf"),
        signers,
      }),
      "admin-1",
    );
    expect(repository.linkEndorsement).toHaveBeenCalledWith("doc-1", "end-9");
  });

  it("menolak berkas yang bukan PDF", async () => {
    documents.getById.mockResolvedValue(legalDocument({ fileContentType: "image/png" }));

    await expect(service.sendForSignature("doc-1", { signers }, CONTEXT)).rejects.toThrow(/PDF/);
    expect(issuer.issue).not.toHaveBeenCalled();
  });

  it("menolak bila masih ada surat yang sedang ditandatangani", async () => {
    documents.getById.mockResolvedValue(legalDocument({ endorsementId: "end-1" }));
    endorsements.getById.mockResolvedValue(endorsement({ status: "SENT" }));

    await expect(service.sendForSignature("doc-1", { signers }, CONTEXT)).rejects.toThrow(
      /sedang dalam proses/,
    );
  });

  it("boleh mengirim ulang bila surat sebelumnya sudah gugur", async () => {
    documents.getById.mockResolvedValue(legalDocument({ endorsementId: "end-1" }));
    endorsements.getById.mockResolvedValue(endorsement({ status: "CANCELLED" }));

    await service.sendForSignature("doc-1", { signers }, CONTEXT);

    expect(issuer.issue).toHaveBeenCalled();
  });
});

describe("applySignedVersion", () => {
  beforeEach(() => repository.findDocumentById.mockResolvedValue(legalDocument()));

  it("mengganti berkas dokumen legal dengan PDF bertanda tangan", async () => {
    expect(await service.applySignedVersion("end-1")).toBe(true);

    expect(storage.save).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      documentId: "doc-1",
      upload: {
        buffer: Buffer.from("%PDF sah"),
        fileName: "pks-sah.pdf",
        contentType: "application/pdf",
      },
    });
    expect(repository.replaceFile).toHaveBeenCalledWith(
      "doc-1",
      expect.objectContaining({ fileKey: "legal/tenant-1/doc-1/pks-sah.pdf" }),
    );
  });

  it("idempoten: berkas yang sudah versi sah tidak diganti ulang", async () => {
    repository.findDocumentById.mockResolvedValue(legalDocument({ fileHash: "f".repeat(64) }));

    expect(await service.applySignedVersion("end-1")).toBe(false);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("mengabaikan surat yang bukan berasal dari dokumen legal", async () => {
    endorsements.getById.mockResolvedValue(endorsement({ sourceType: "UPLOAD", sourceId: null }));

    expect(await service.applySignedVersion("end-1")).toBe(false);
    expect(repository.findDocumentById).not.toHaveBeenCalled();
  });
});

describe("archiveEndorsement", () => {
  const payload = {
    title: "Kontrak korporat",
    documentType: "KONTRAK" as const,
    currency: "IDR",
    isAutoRenew: false,
    obligations: [] as Array<{ description: string; dueDate: Date; recurrence: "NONE" | "MONTHLY" | "YEARLY" }>,
  };

  it("membuat dokumen legal dari PDF sah dan menautkan suratnya", async () => {
    await service.archiveEndorsement("end-1", payload, CONTEXT);

    expect(documents.create).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        buffer: Buffer.from("%PDF sah"),
        fileName: "PGS-202610-0007-sah.pdf",
        contentType: "application/pdf",
      }),
      { ...CONTEXT, endorsementId: "end-1" },
    );
  });

  it("menolak surat yang belum sah", async () => {
    endorsements.getById.mockResolvedValue(endorsement({ status: "SENT", signedFileKey: null }));

    await expect(service.archiveEndorsement("end-1", payload, CONTEXT)).rejects.toThrow(/sudah sah/);
  });

  it("menolak mengarsipkan surat yang sama dua kali", async () => {
    repository.findDocumentIdByEndorsement.mockResolvedValue("doc-lama");

    await expect(service.archiveEndorsement("end-1", payload, CONTEXT)).rejects.toThrow(
      /sudah tersimpan/,
    );
    expect(documents.create).not.toHaveBeenCalled();
  });
});
