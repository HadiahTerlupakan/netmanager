import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMobileToken = vi.fn();
const getToken = vi.fn();

vi.mock("@/lib/mobile-auth", () => ({
  verifyMobileToken: (...args: unknown[]) => verifyMobileToken(...args),
}));

vi.mock("next-auth/jwt", () => ({
  getToken: (...args: unknown[]) => getToken(...args),
}));

import {
  bolehBacaJalurUpload,
  pembacaUploadDariSesi,
  punyaAksesBacaUpload,
} from "@/lib/upload/upload-access";

/**
 * Penjaga `/uploads/` dulu hanya membaca cookie NextAuth. Aplikasi mobile tidak
 * pernah memegang cookie itu — ia memakai Bearer token sendiri — sehingga foto
 * yang baru saja ia unggah selalu balas 401 saat hendak ditampilkan kembali.
 *
 * Sesi saja juga tidak cukup: tanpa pemeriksaan tenant, pemegang sesi tenant
 * mana pun bisa membaca KTP pelanggan tenant lain asal tahu URL-nya.
 */

function permintaan(authorization?: string) {
  return { headers: authorization ? { authorization } : {} };
}

const JALUR_TENANT_A = "/uploads/tenants/tenant-a/marketing/canvasing/ktp.webp";
const JALUR_LAMA = "/uploads/marketing/canvasing/ktp.webp";

beforeEach(() => {
  verifyMobileToken.mockReset();
  getToken.mockReset();
  getToken.mockResolvedValue(null);
});

describe("pembaca upload dari sesi", () => {
  it("mengenali token mobile beserta tenant-nya", async () => {
    verifyMobileToken.mockResolvedValue({
      userId: "u-1",
      tenantId: "tenant-a",
    });

    await expect(
      pembacaUploadDariSesi(permintaan("Bearer sah")),
    ).resolves.toEqual({ tenantId: "tenant-a", isSuperAdmin: false });
    expect(verifyMobileToken).toHaveBeenCalledWith("sah");
  });

  it("menolak token mobile yang tidak sah", async () => {
    verifyMobileToken.mockResolvedValue(null);

    await expect(
      pembacaUploadDariSesi(permintaan("Bearer palsu")),
    ).resolves.toBeNull();
  });

  it("tetap mengenali sesi web lewat cookie", async () => {
    getToken.mockResolvedValue({ id: "u-1", tenantId: "tenant-b" });

    await expect(pembacaUploadDariSesi(permintaan())).resolves.toEqual({
      tenantId: "tenant-b",
      isSuperAdmin: false,
    });
    expect(verifyMobileToken).not.toHaveBeenCalled();
  });

  it("tanpa sesi apa pun hasilnya null", async () => {
    await expect(pembacaUploadDariSesi(permintaan())).resolves.toBeNull();
  });

  // Klien yang belum login kadang mengirim string "null" apa adanya; itu bukan
  // token dan tidak boleh sampai ke verifikasi.
  it("mengabaikan Bearer kosong atau literal null", async () => {
    await expect(
      pembacaUploadDariSesi(permintaan("Bearer null")),
    ).resolves.toBeNull();
    await expect(
      pembacaUploadDariSesi(permintaan("Bearer ")),
    ).resolves.toBeNull();
    expect(verifyMobileToken).not.toHaveBeenCalled();
  });

  // Verifikasi token bisa melempar (mis. Redis mati). Permintaan web yang
  // kebetulan membawa header Authorization lain tidak boleh ikut gagal total.
  it("jatuh ke cookie ketika verifikasi token melempar", async () => {
    verifyMobileToken.mockRejectedValue(new Error("redis mati"));
    getToken.mockResolvedValue({ id: "u-1", tenantId: "tenant-b" });

    await expect(
      pembacaUploadDariSesi(permintaan("Bearer rusak")),
    ).resolves.toEqual({ tenantId: "tenant-b", isSuperAdmin: false });
  });

  it("mengabaikan skema selain Bearer", async () => {
    await expect(
      pembacaUploadDariSesi(permintaan("Basic abc")),
    ).resolves.toBeNull();
    expect(verifyMobileToken).not.toHaveBeenCalled();
  });
});

describe("boleh baca jalur upload", () => {
  it("tenant pemilik boleh membaca", () => {
    expect(
      bolehBacaJalurUpload(
        { tenantId: "tenant-a", isSuperAdmin: false },
        JALUR_TENANT_A,
      ),
    ).toBe(true);
  });

  // Inti perbaikannya: sesi sah milik tenant lain tetap ditolak.
  it("tenant lain ditolak", () => {
    expect(
      bolehBacaJalurUpload(
        { tenantId: "tenant-b", isSuperAdmin: false },
        JALUR_TENANT_A,
      ),
    ).toBe(false);
  });

  it("sesi tanpa tenant ditolak atas jalur ber-tenant", () => {
    expect(
      bolehBacaJalurUpload(
        { tenantId: null, isSuperAdmin: false },
        JALUR_TENANT_A,
      ),
    ).toBe(false);
  });

  it("super admin boleh lintas tenant", () => {
    expect(
      bolehBacaJalurUpload(
        { tenantId: "tenant-b", isSuperAdmin: true },
        JALUR_TENANT_A,
      ),
    ).toBe(true);
  });

  // Berkas yang terlanjur tersimpan tanpa segmen tenant tidak bisa dikaitkan ke
  // tenant mana pun; memblokirnya akan membuat seluruh foto lama tidak terbuka.
  it("jalur lama tanpa namespace tetap terbuka bagi pemegang sesi", () => {
    expect(
      bolehBacaJalurUpload(
        { tenantId: "tenant-b", isSuperAdmin: false },
        JALUR_LAMA,
      ),
    ).toBe(true);
  });
});

describe("punya akses baca upload", () => {
  it("menolak permintaan tanpa sesi", async () => {
    await expect(
      punyaAksesBacaUpload(permintaan(), JALUR_TENANT_A),
    ).resolves.toBe(false);
  });

  it("menolak sesi sah dari tenant lain", async () => {
    verifyMobileToken.mockResolvedValue({
      userId: "u-1",
      tenantId: "tenant-b",
    });

    await expect(
      punyaAksesBacaUpload(permintaan("Bearer sah"), JALUR_TENANT_A),
    ).resolves.toBe(false);
  });

  it("meloloskan tenant pemilik", async () => {
    verifyMobileToken.mockResolvedValue({
      userId: "u-1",
      tenantId: "tenant-a",
    });

    await expect(
      punyaAksesBacaUpload(permintaan("Bearer sah"), JALUR_TENANT_A),
    ).resolves.toBe(true);
  });
});
