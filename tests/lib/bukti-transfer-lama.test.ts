import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { tmpdir } from "os";
import path from "path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { prismaMock } from "../setup";

const palsu = vi.hoisted(() => ({ pembaca: vi.fn() }));

vi.mock("@/lib/upload/upload-access", () => ({
  pembacaUploadDariSesi: palsu.pembaca,
}));

import {
  bolehBacaBuktiLama,
  kanonikJalurBuktiLama,
  sajikanBuktiTransferLama,
} from "@/lib/upload/bukti-transfer-lama";

/**
 * Bukti transfer dari penyimpanan lokal lama ada di `public/receipts` dan
 * dulu disajikan handler statis Next kepada siapa saja yang tahu URL-nya.
 * Kini hanya staf tenant pembayarannya (dan super admin) yang bisa
 * membukanya; portal dan aplikasi tidak pernah menampilkan bukti kepada
 * pelanggan, jadi pelanggan pun tidak.
 */
const BERKAS =
  "receipt_0859bd5c-94fe-4adc-837d-69f243363786_1772147845645.webp";
const JALUR = `/receipts/${BERKAS}`;
const ISI = Buffer.from("RIFF-bukti-transfer-WEBP");

const STAF_A = { tenantId: "tenant-a", isSuperAdmin: false };
const STAF_B = { tenantId: "tenant-b", isSuperAdmin: false };
const SUPER_ADMIN = { tenantId: null as string | null, isSuperAdmin: true };
const PELANGGAN_PEMILIK = {
  tenantId: "tenant-a",
  isSuperAdmin: false,
  pelangganId: "pel-1",
};

function paymentDenganBukti(tenantId: string | null = "tenant-a") {
  prismaMock.payment.findMany.mockResolvedValue([
    { tenantId, pelangganId: "pel-1" },
  ]);
}

describe("jalur bukti transfer lama", () => {
  it("menerima satu berkas WebP langsung di bawah /receipts", () => {
    expect(kanonikJalurBuktiLama(JALUR)).toBe(JALUR);
  });

  it("men-decode jalur seperti handler statis Next", () => {
    expect(kanonikJalurBuktiLama(`/%72eceipts%2F${BERKAS}`)).toBe(JALUR);
  });

  it.each([
    "/receipts/../uploads/tenants/a/x.webp",
    "/receipts/..%2fuploads%2fx.webp",
    "/receipts/sub/x.webp",
    "/receipts/",
    "/receipts/x.png",
    "/receipts/%E0%A4%A.webp",
    "/receipts/x.webp%00.txt",
  ])("menolak %s", (pathname) => {
    expect(kanonikJalurBuktiLama(pathname)).toBeNull();
  });
});

describe("hak baca bukti transfer lama", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paymentDenganBukti();
  });

  it("staf tenant pembayarannya boleh membaca", async () => {
    await expect(bolehBacaBuktiLama(STAF_A, JALUR)).resolves.toBe(true);
    expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { receiptUrl: JALUR } }),
    );
  });

  it("staf tenant lain tidak", async () => {
    await expect(bolehBacaBuktiLama(STAF_B, JALUR)).resolves.toBe(false);
  });

  it("super admin boleh membaca", async () => {
    await expect(bolehBacaBuktiLama(SUPER_ADMIN, JALUR)).resolves.toBe(true);
  });

  it("pelanggan pemiliknya pun tidak: bukti tidak pernah ditampilkan kepadanya", async () => {
    await expect(bolehBacaBuktiLama(PELANGGAN_PEMILIK, JALUR)).resolves.toBe(
      false,
    );
    expect(prismaMock.payment.findMany).not.toHaveBeenCalled();
  });

  it("berkas yang tidak dirujuk payment mana pun tidak bisa dibaca siapa pun", async () => {
    prismaMock.payment.findMany.mockResolvedValue([]);

    await expect(bolehBacaBuktiLama(SUPER_ADMIN, JALUR)).resolves.toBe(false);
    await expect(bolehBacaBuktiLama(STAF_A, JALUR)).resolves.toBe(false);
  });

  // Payment lama dari billing harian tersimpan tanpa tenantId.
  it("payment tanpa tenant memakai tenant pelanggannya", async () => {
    paymentDenganBukti(null);
    prismaMock.pelanggan.findMany.mockResolvedValue([{ tenantId: "tenant-a" }]);

    await expect(bolehBacaBuktiLama(STAF_A, JALUR)).resolves.toBe(true);
    await expect(bolehBacaBuktiLama(STAF_B, JALUR)).resolves.toBe(false);
    expect(prismaMock.pelanggan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["pel-1"] } } }),
    );
  });

  it("staf tanpa tenant tidak membaca bukti tenant mana pun", async () => {
    await expect(
      bolehBacaBuktiLama({ tenantId: null, isSuperAdmin: false }, JALUR),
    ).resolves.toBe(false);
  });
});

describe("penyajian bukti transfer lama", () => {
  let direktoriPublik: string;
  let server: Server;
  let alamat: string;

  beforeAll(async () => {
    direktoriPublik = await mkdtemp(path.join(tmpdir(), "bukti-lama-"));
    await mkdir(path.join(direktoriPublik, "receipts"));
    await writeFile(path.join(direktoriPublik, "receipts", BERKAS), ISI);
    server = createServer((req, res) => {
      void sajikanBuktiTransferLama(req, res, req.url ?? "/", direktoriPublik);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    alamat = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(direktoriPublik, { recursive: true, force: true });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    paymentDenganBukti();
  });

  const minta = (jalur: string, method = "GET") =>
    fetch(`${alamat}${jalur}`, { method });

  it("tanpa sesi: 401", async () => {
    palsu.pembaca.mockResolvedValue(null);

    const jawaban = await minta(JALUR);

    expect(jawaban.status).toBe(401);
    expect(prismaMock.payment.findMany).not.toHaveBeenCalled();
  });

  it("staf tenant pembayarannya menerima berkasnya, tanpa cache bersama", async () => {
    palsu.pembaca.mockResolvedValue(STAF_A);

    const jawaban = await minta(JALUR);

    expect({
      status: jawaban.status,
      contentType: jawaban.headers.get("content-type"),
      cacheControl: jawaban.headers.get("cache-control"),
      isi: Buffer.from(await jawaban.arrayBuffer()).equals(ISI),
    }).toEqual({
      status: 200,
      contentType: "image/webp",
      cacheControl: "private, no-store",
      isi: true,
    });
  });

  it("jalur ter-encode melewati penjaga yang sama", async () => {
    const jalurTerEncode = `/%72eceipts/${BERKAS}`;

    palsu.pembaca.mockResolvedValue(STAF_B);
    const tenantLain = await minta(jalurTerEncode);
    palsu.pembaca.mockResolvedValue(STAF_A);
    const tenantSendiri = await minta(jalurTerEncode);

    expect([tenantLain.status, tenantSendiri.status]).toEqual([404, 200]);
  });

  it.each([
    ["staf tenant lain", STAF_B],
    ["pelanggan pemiliknya", PELANGGAN_PEMILIK],
  ])("%s: 404 tanpa isi berkas", async (_siapa, pembaca) => {
    palsu.pembaca.mockResolvedValue(pembaca);

    const jawaban = await minta(JALUR);

    expect(jawaban.status).toBe(404);
    expect(await jawaban.text()).not.toContain("RIFF");
  });

  it("berkas yang dirujuk tetapi tidak ada di disk: 404", async () => {
    palsu.pembaca.mockResolvedValue(STAF_A);

    const jawaban = await minta("/receipts/receipt_hilang_1.webp");

    expect(jawaban.status).toBe(404);
  });

  it("HEAD hanya mengirim header", async () => {
    palsu.pembaca.mockResolvedValue(STAF_A);

    const jawaban = await minta(JALUR, "HEAD");

    expect(jawaban.status).toBe(200);
    expect(jawaban.headers.get("content-length")).toBe(String(ISI.length));
  });

  it("metode selain GET dan HEAD: 404", async () => {
    palsu.pembaca.mockResolvedValue(STAF_A);

    const jawaban = await minta(JALUR, "DELETE");

    expect(jawaban.status).toBe(404);
  });

  it("pemeriksaan yang gagal tidak menyajikan berkas", async () => {
    palsu.pembaca.mockResolvedValue(STAF_A);
    prismaMock.payment.findMany.mockRejectedValue(new Error("db mati"));

    const jawaban = await minta(JALUR);

    expect(jawaban.status).toBe(500);
    expect(await jawaban.text()).not.toContain("db mati");
  });
});
