import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant-context", () => ({
  getTenantIdFromContext: async () => ({ tenantId: "tenant-1", isSuperAdmin: false }),
}));

import { LegalDocumentService } from "@/modules/legal/services/LegalDocumentService";
import { buildLegalRepository, legalDocument, wib } from "./legal-fixtures";

const ACCESS = { canViewConfidential: false };
const UPLOAD = { buffer: Buffer.from("%PDF"), fileName: "baru.pdf", contentType: "application/pdf" };

let repository: ReturnType<typeof buildLegalRepository>;
let storage: { save: ReturnType<typeof vi.fn>; read: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };
let categories: { assertUsable: ReturnType<typeof vi.fn> };
let directory: { filterActiveEmployeeIds: ReturnType<typeof vi.fn<(ids: string[]) => Promise<string[]>>> };
let service: LegalDocumentService;

beforeEach(() => {
  repository = buildLegalRepository();
  storage = {
    save: vi.fn().mockResolvedValue({
      fileKey: "legal/tenant-1/x/baru.pdf",
      fileName: "baru.pdf",
      fileHash: "b".repeat(64),
      fileContentType: "application/pdf",
    }),
    read: vi.fn(),
    remove: vi.fn(),
  };
  categories = { assertUsable: vi.fn() };
  directory = { filterActiveEmployeeIds: vi.fn<(ids: string[]) => Promise<string[]>>(async (ids) => ids) };
  service = new LegalDocumentService(
    repository as never,
    storage as never,
    categories as never,
    directory,
  );
});

const createPayload = {
  title: "PKS Reseller",
  documentType: "KONTRAK" as const,
  currency: "IDR",
  isAutoRenew: false,
  obligations: [] as Array<{ description: string; dueDate: Date; recurrence: "NONE" | "MONTHLY" | "YEARLY" }>,
};

describe("create", () => {
  it("menyimpan berkas lalu mencatat dokumen di tenant aktif", async () => {
    await service.create(createPayload, UPLOAD, { userId: "admin-1", access: ACCESS });

    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", upload: UPLOAD }),
    );
    expect(repository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "PKS Reseller",
        fileKey: "legal/tenant-1/x/baru.pdf",
        createdById: "admin-1",
        tenantId: "tenant-1",
      }),
    );
  });

  it("membuang berkas bila pencatatan gagal", async () => {
    repository.createDocument.mockRejectedValue(new Error("db mati"));

    await expect(
      service.create(createPayload, UPLOAD, { userId: "admin-1", access: ACCESS }),
    ).rejects.toThrow("db mati");
    expect(storage.remove).toHaveBeenCalledWith("legal/tenant-1/x/baru.pdf");
  });

  it("menolak PIC yang bukan karyawan aktif", async () => {
    directory.filterActiveEmployeeIds.mockResolvedValue([]);

    await expect(
      service.create({ ...createPayload, picUserId: "orang-luar" }, UPLOAD, {
        userId: "admin-1",
        access: ACCESS,
      }),
    ).rejects.toThrow(/karyawan aktif/);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("memeriksa kategori sesuai jenis dokumen", async () => {
    await service.create({ ...createPayload, categoryId: "cat-9" }, UPLOAD, {
      userId: "admin-1",
      access: ACCESS,
    });

    expect(categories.assertUsable).toHaveBeenCalledWith("cat-9", "KONTRAK", ACCESS);
  });
});

describe("getById", () => {
  it("404 untuk dokumen yang tidak ada atau rahasia tanpa akses", async () => {
    repository.findDocumentById.mockResolvedValue(null);

    await expect(service.getById("doc-1", ACCESS)).rejects.toThrow(/tidak ditemukan/);
    expect(repository.findDocumentById).toHaveBeenCalledWith("doc-1", ACCESS);
  });
});

describe("renew", () => {
  const previous = legalDocument({
    endDate: wib("2026-12-31"),
    noticePeriodDays: 60,
    isAutoRenew: true,
    value: "12000000.00",
    obligations: [
      { id: "ob-1", description: "Bayar sewa", dueDate: wib("2026-12-01"), recurrence: "YEARLY" },
    ],
  });

  beforeEach(() => repository.findDocumentById.mockResolvedValue(previous));

  it("membuat dokumen baru yang menautkan versi lama dan membawa atributnya", async () => {
    await service.renew(
      "doc-1",
      { endDate: wib("2027-12-31") },
      null,
      { userId: "admin-1", access: ACCESS },
    );

    expect(repository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        previousDocumentId: "doc-1",
        endDate: wib("2027-12-31"),
        noticePeriodDays: 60,
        isAutoRenew: true,
        value: "12000000.00",
        picUserId: "pic-1",
        categoryId: "cat-1",
        // Tanpa unggahan baru, berkas lama dipakai ulang.
        fileKey: "legal/tenant-1/doc-1/pks.pdf",
        obligations: previous.obligations,
      }),
    );
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("memakai berkas baru bila diunggah", async () => {
    await service.renew("doc-1", { endDate: wib("2027-12-31") }, UPLOAD, {
      userId: "admin-1",
      access: ACCESS,
    });

    expect(repository.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fileKey: "legal/tenant-1/x/baru.pdf" }),
    );
  });

  it.each([
    ["diperpanjang", { renewedById: "doc-2" }],
    ["diakhiri", { terminatedAt: new Date() }],
  ])("menolak dokumen yang sudah %s", async (_label, over) => {
    repository.findDocumentById.mockResolvedValue(legalDocument(over));

    await expect(
      service.renew("doc-1", { endDate: wib("2027-12-31") }, null, {
        userId: "admin-1",
        access: ACCESS,
      }),
    ).rejects.toThrow(/sudah diperpanjang atau diakhiri/);
  });
});

describe("terminate", () => {
  it("mengakhiri dokumen yang masih dipantau", async () => {
    repository.findDocumentById.mockResolvedValue(legalDocument());

    await service.terminate("doc-1", "Kerja sama diputus", ACCESS);

    expect(repository.terminateDocument).toHaveBeenCalledWith(
      "doc-1",
      "Kerja sama diputus",
      expect.any(Date),
    );
  });

  it("menolak mengakhiri ulang", async () => {
    repository.findDocumentById.mockResolvedValue(legalDocument({ terminatedAt: new Date() }));

    await expect(service.terminate("doc-1", "lagi", ACCESS)).rejects.toThrow(/diakhiri/);
  });
});

describe("update", () => {
  it("mengganti kewajiban dengan tenant dokumen", async () => {
    repository.findDocumentById.mockResolvedValue(legalDocument());
    const obligations = [
      { description: "Laporan Komdigi", dueDate: wib("2027-03-31"), recurrence: "YEARLY" as const },
    ];

    await service.update("doc-1", { notes: "catatan", obligations }, ACCESS);

    expect(repository.updateDocument).toHaveBeenCalledWith(
      "doc-1",
      { notes: "catatan" },
      obligations,
      "tenant-1",
    );
  });
});
