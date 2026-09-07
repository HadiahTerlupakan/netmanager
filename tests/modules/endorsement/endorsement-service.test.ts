import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Token short link hanya dikembalikan sekali saat surat dibuat; yang tersimpan
 * cuma sidik jarinya. Perilaku itu, ditambah penegakan aturan domain di jalur
 * tanda tangan, adalah inti keamanan modul ini.
 */

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: async () => ({
    tenantId: "tenant-1",
    isSuperAdmin: false,
  }),
}));

import { EndorsementService } from "@/modules/endorsement/services/EndorsementService";
import { hashSignerToken } from "@/modules/endorsement/services/endorsement-token";
import type { IEndorsementRepository } from "@/modules/endorsement/domain/ports/IEndorsementRepository";
import type {
  EndorsementEntity,
  EndorsementSignerEntity,
} from "@/modules/endorsement/domain/entities/Endorsement";

const signer = (
  over: Partial<EndorsementSignerEntity> = {},
): EndorsementSignerEntity => ({
  id: "signer-1",
  endorsementId: "end-1",
  name: "Budi",
  role: "Direktur",
  email: "budi@contoh.id",
  phone: null,
  userId: null,
  status: "PENDING",
  signatureKey: null,
  viewedAt: null,
  signedAt: null,
  declinedAt: null,
  declineReason: null,
  order: 0,
  ...over,
});

const endorsement = (over: Record<string, unknown> = {}): EndorsementEntity =>
  ({
    id: "end-1",
    number: "PGS/202609/0001",
    title: "Berita Acara",
    description: null,
    status: "SENT",
    sourceType: "UPLOAD",
    sourceId: null,
    sourceFileKey: "pengesahan/tenant-1/end-1/sumber-doc.pdf",
    sourceFileName: "doc.pdf",
    sourceFileHash: "a".repeat(64),
    signedFileKey: null,
    signedFileHash: null,
    expiresAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    createdById: "user-1",
    tenantId: "tenant-1",
    createdAt: new Date("2026-09-07T00:00:00.000Z"),
    signers: [signer()],
    ...over,
  }) as EndorsementEntity;

const buildRepository = () => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  findByTokenHash: vi.fn(),
  findLastNumber: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  updateStatus: vi.fn(),
  updateSigner: vi.fn(),
  recordEvent: vi.fn(),
  findExpiredIds: vi.fn().mockResolvedValue([]),
});

const buildPdf = () => ({
  buildSignedPdf: vi
    .fn()
    .mockResolvedValue({ key: "kunci-final", hash: "c".repeat(64) }),
});

const buildStorage = () => ({
  saveSourcePdf: vi
    .fn()
    .mockResolvedValue({ key: "kunci-sumber", hash: "b".repeat(64) }),
  saveSignature: vi.fn().mockResolvedValue("kunci-ttd"),
  saveSignedPdf: vi.fn(),
  read: vi.fn(),
  removeAll: vi.fn(),
});

type Repo = ReturnType<typeof buildRepository>;
type Storage = ReturnType<typeof buildStorage>;
type Pdf = ReturnType<typeof buildPdf>;

let repository: Repo;
let storage: Storage;
let pdf: Pdf;
let service: EndorsementService;

const buildService = () =>
  new EndorsementService(
    repository as unknown as IEndorsementRepository,
    storage as unknown as ConstructorParameters<typeof EndorsementService>[1],
    pdf as unknown as ConstructorParameters<typeof EndorsementService>[2],
  );

const createCommand = {
  title: "Berita Acara",
  sourceType: "UPLOAD" as const,
  fileName: "doc.pdf",
  fileBuffer: Buffer.from("pdf"),
  signers: [
    { name: "Budi", email: "budi@contoh.id" },
    { name: "Sari", phone: "08123" },
  ],
};

beforeEach(() => {
  repository = buildRepository();
  storage = buildStorage();
  pdf = buildPdf();
  repository.create.mockImplementation(async () =>
    endorsement({
      status: "DRAFT",
      signers: [signer(), signer({ id: "signer-2", name: "Sari" })],
    }),
  );
  service = buildService();
});

describe("create", () => {
  it("menyimpan sidik jari token, bukan tokennya", async () => {
    const { links } = await service.create(createCommand, "user-1");

    const stored = repository.create.mock.calls[0][0].signers as Array<{
      tokenHash: string;
    }>;

    for (const [index, entry] of stored.entries()) {
      expect(entry.tokenHash).toBe(hashSignerToken(links[index]!.token));
      expect(entry).not.toHaveProperty("token");
    }
  });

  it("menerbitkan token berbeda untuk tiap penanda tangan", async () => {
    const { links } = await service.create(createCommand, "user-1");

    expect(links).toHaveLength(2);
    expect(links[0]!.token).not.toBe(links[1]!.token);
  });

  it("mencatat jejak audit pembuatan", async () => {
    await service.create(createCommand, "user-1");

    expect(repository.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CREATED" }),
    );
  });

  // Berkas diunggah sebelum baris dibuat; kalau baris gagal, objeknya harus
  // dibuang supaya tidak ada dokumen rahasia yatim di penyimpanan.
  it("membuang berkas saat pembuatan baris gagal", async () => {
    repository.create.mockRejectedValue(new Error("db mati"));

    await expect(service.create(createCommand, "user-1")).rejects.toThrow(
      "db mati",
    );
    expect(storage.removeAll).toHaveBeenCalledWith(["kunci-sumber"]);
  });

  it("memberi masa berlaku bawaan bila tidak ditentukan", async () => {
    await service.create(createCommand, "user-1");

    const payload = repository.create.mock.calls[0][0] as { expiresAt: Date };

    expect(payload.expiresAt).toBeInstanceOf(Date);
    expect(payload.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("sign", () => {
  beforeEach(() => {
    repository.findByTokenHash.mockResolvedValue({
      endorsement: endorsement(),
      signerId: "signer-1",
    });
    repository.findById.mockResolvedValue(
      endorsement({ signers: [signer({ status: "SIGNED" })] }),
    );
  });

  it("menyimpan tanda tangan dan menandai penanda tangan", async () => {
    await service.sign("token-uji", Buffer.from("png"), {});

    expect(storage.saveSignature).toHaveBeenCalled();
    expect(repository.updateSigner).toHaveBeenCalledWith(
      "signer-1",
      expect.objectContaining({ status: "SIGNED", signatureKey: "kunci-ttd" }),
    );
  });

  it("menandai surat selesai setelah semua menandatangani", async () => {
    const result = await service.sign("token-uji", Buffer.from("png"), {});

    expect(result.completed).toBe(true);
    expect(repository.updateStatus).toHaveBeenCalledWith(
      "end-1",
      "COMPLETED",
      expect.objectContaining({
        completedAt: expect.any(Date),
        signedFileKey: "kunci-final",
      }),
    );
  });

  // Kalau urutannya dibalik, surat sempat terlihat sah padahal PDF finalnya
  // belum ada, dan pemegang tautan menerima dokumen tanpa lembar pengesahan.
  it("menyusun PDF gabungan sebelum menaikkan status", async () => {
    await service.sign("token-uji", Buffer.from("png"), {});

    const pdfOrder = pdf.buildSignedPdf.mock.invocationCallOrder[0]!;
    const completedCall = repository.updateStatus.mock.calls.findIndex(
      ([, status]) => status === "COMPLETED",
    );
    const statusOrder =
      repository.updateStatus.mock.invocationCallOrder[completedCall]!;

    expect(pdfOrder).toBeLessThan(statusOrder);
  });

  it("tidak menyusun PDF selama masih ada yang menunggu", async () => {
    repository.findById.mockResolvedValue(
      endorsement({
        signers: [signer({ status: "SIGNED" }), signer({ id: "s2" })],
      }),
    );

    await service.sign("token-uji", Buffer.from("png"), {});

    expect(pdf.buildSignedPdf).not.toHaveBeenCalled();
  });

  it("belum selesai bila masih ada yang menunggu", async () => {
    repository.findById.mockResolvedValue(
      endorsement({
        signers: [signer({ status: "SIGNED" }), signer({ id: "s2" })],
      }),
    );

    const result = await service.sign("token-uji", Buffer.from("png"), {});

    expect(result.completed).toBe(false);
  });

  it("menolak tanda tangan kedua dari orang yang sama", async () => {
    repository.findByTokenHash.mockResolvedValue({
      endorsement: endorsement({ signers: [signer({ status: "SIGNED" })] }),
      signerId: "signer-1",
    });

    await expect(
      service.sign("token-uji", Buffer.from("png"), {}),
    ).rejects.toThrow(/tidak bisa dipakai/i);
    expect(storage.saveSignature).not.toHaveBeenCalled();
  });

  it("menolak setelah masa berlaku habis", async () => {
    repository.findByTokenHash.mockResolvedValue({
      endorsement: endorsement({ expiresAt: new Date("2020-01-01") }),
      signerId: "signer-1",
    });

    await expect(
      service.sign("token-uji", Buffer.from("png"), {}),
    ).rejects.toThrow(/masa berlaku/i);
  });

  it("menolak token yang tidak dikenali", async () => {
    repository.findByTokenHash.mockResolvedValue(null);

    await expect(
      service.sign("token-asing", Buffer.from("png"), {}),
    ).rejects.toThrow(/tidak dikenali/i);
  });
});

describe("decline", () => {
  beforeEach(() => {
    repository.findByTokenHash.mockResolvedValue({
      endorsement: endorsement(),
      signerId: "signer-1",
    });
    repository.findById.mockResolvedValue(endorsement({ status: "CANCELLED" }));
  });

  it("satu penolakan menggugurkan surat", async () => {
    await service.decline("token-uji", "data salah", {});

    expect(repository.updateStatus).toHaveBeenCalledWith(
      "end-1",
      "CANCELLED",
      expect.objectContaining({
        cancelReason: expect.stringContaining("Budi"),
      }),
    );
  });
});

describe("markSent", () => {
  it("hanya boleh dari draf", async () => {
    repository.findById.mockResolvedValue(endorsement({ status: "SENT" }));

    await expect(service.markSent("end-1")).rejects.toThrow(/draf/i);
  });
});

describe("cancel", () => {
  it("menolak membatalkan surat yang sudah sah", async () => {
    repository.findById.mockResolvedValue(endorsement({ status: "COMPLETED" }));

    await expect(service.cancel("end-1", "alasan")).rejects.toThrow(
      /sudah sah/i,
    );
  });
});

describe("expireOverdue", () => {
  it("menandai surat yang lewat masa berlaku", async () => {
    repository.findExpiredIds.mockResolvedValue(["end-1", "end-2"]);
    repository.findById.mockResolvedValue(endorsement());

    expect(await service.expireOverdue()).toBe(2);
    expect(repository.updateStatus).toHaveBeenCalledWith("end-1", "EXPIRED");
  });
});
