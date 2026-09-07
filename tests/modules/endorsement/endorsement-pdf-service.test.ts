import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import { EndorsementPdfService } from "@/modules/endorsement";
import type {
  EndorsementEntity,
  EndorsementSignerEntity,
} from "@/modules/endorsement";

/**
 * Hasil akhir pengesahan harus satu berkas: seluruh halaman dokumen asal apa
 * adanya, lalu satu lembar pengesahan berisi tanda tangan. Tes ini menyusun PDF
 * sungguhan lalu membacanya kembali — bukan sekadar memastikan fungsinya
 * dipanggil.
 */

/** PNG 1x1 piksel yang sah, dipakai sebagai tanda tangan tiruan. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function buildSourcePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let index = 0; index < pageCount; index++) {
    doc.addPage([595.28, 841.89]);
  }

  return Buffer.from(await doc.save());
}

const signer = (
  over: Partial<EndorsementSignerEntity> = {},
): EndorsementSignerEntity => ({
  id: "signer-1",
  endorsementId: "end-1",
  name: "Budi Santoso",
  role: "Direktur Operasional",
  email: "budi@contoh.id",
  phone: null,
  userId: null,
  status: "SIGNED",
  signatureKey: "kunci-ttd-1",
  viewedAt: new Date(),
  signedAt: new Date("2026-09-07T03:00:00.000Z"),
  declinedAt: null,
  declineReason: null,
  order: 0,
  ...over,
});

const endorsement = (over: Record<string, unknown> = {}): EndorsementEntity =>
  ({
    id: "end-1",
    number: "PGS/202609/0001",
    title: "Berita Acara Serah Terima Pekerjaan",
    description: null,
    status: "SENT",
    sourceType: "UPLOAD",
    sourceId: null,
    sourceFileKey: "kunci-sumber",
    sourceFileName: "berita-acara.pdf",
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

let sourcePdf: Buffer;
let storage: {
  read: ReturnType<typeof vi.fn>;
  saveSignedPdf: ReturnType<typeof vi.fn>;
};

const buildService = () =>
  new EndorsementPdfService(
    storage as unknown as ConstructorParameters<
      typeof EndorsementPdfService
    >[0],
  );

/** Berkas yang diserahkan ke penyimpanan, dibaca ulang sebagai PDF. */
const savedPdf = async () => {
  const buffer = storage.saveSignedPdf.mock.calls[0][0].buffer as Buffer;

  return PDFDocument.load(buffer);
};

beforeEach(async () => {
  sourcePdf = await buildSourcePdf(2);
  storage = {
    read: vi.fn(async (key: string) =>
      key === "kunci-sumber" ? sourcePdf : TINY_PNG,
    ),
    saveSignedPdf: vi
      .fn()
      .mockResolvedValue({ key: "kunci-final", hash: "b".repeat(64) }),
  };
});

describe("buildSignedPdf", () => {
  it("mempertahankan seluruh halaman dokumen asal dan menambah satu lembar pengesahan", async () => {
    await buildService().buildSignedPdf(endorsement());

    expect((await savedPdf()).getPageCount()).toBe(3);
  });

  it("ikut menambah lembar pengesahan pada dokumen satu halaman", async () => {
    sourcePdf = await buildSourcePdf(1);

    await buildService().buildSignedPdf(endorsement());

    expect((await savedPdf()).getPageCount()).toBe(2);
  });

  it("menghasilkan PDF yang sah dan tidak kosong", async () => {
    await buildService().buildSignedPdf(endorsement());

    const buffer = storage.saveSignedPdf.mock.calls[0][0].buffer as Buffer;

    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it("menempel tanda tangan setiap penanda tangan", async () => {
    await buildService().buildSignedPdf(
      endorsement({
        signers: [
          signer(),
          signer({ id: "signer-2", signatureKey: "kunci-ttd-2" }),
          signer({ id: "signer-3", signatureKey: "kunci-ttd-3" }),
        ],
      }),
    );

    const signatureReads = storage.read.mock.calls.filter(([key]) =>
      String(key).startsWith("kunci-ttd"),
    );

    expect(signatureReads).toHaveLength(3);
  });

  // Satu gambar yang gagal dimuat tidak boleh membatalkan seluruh berkas —
  // ketiadaannya sudah terlihat jelas di lembar hasil.
  it("tetap menghasilkan berkas walau satu tanda tangan gagal dimuat", async () => {
    storage.read.mockImplementation(async (key: string) => {
      if (key === "kunci-sumber") return sourcePdf;
      if (key === "kunci-ttd-2") throw new Error("objek hilang");
      return TINY_PNG;
    });

    await buildService().buildSignedPdf(
      endorsement({
        signers: [
          signer(),
          signer({ id: "signer-2", signatureKey: "kunci-ttd-2" }),
        ],
      }),
    );

    expect((await savedPdf()).getPageCount()).toBe(3);
  });

  it("menyimpan hasil di bawah tenant dan surat yang benar", async () => {
    await buildService().buildSignedPdf(endorsement());

    expect(storage.saveSignedPdf).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", endorsementId: "end-1" }),
    );
  });
});
