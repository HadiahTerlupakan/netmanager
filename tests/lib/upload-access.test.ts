import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMobileToken = vi.fn();
const getToken = vi.fn();

vi.mock("@/lib/mobile-auth", () => ({
  verifyMobileToken: (...args: unknown[]) => verifyMobileToken(...args),
}));

vi.mock("next-auth/jwt", () => ({
  getToken: (...args: unknown[]) => getToken(...args),
}));

import { punyaSesiBacaUpload } from "@/lib/upload/upload-access";

/**
 * Penjaga `/uploads/` dulu hanya membaca cookie NextAuth. Aplikasi mobile tidak
 * pernah memegang cookie itu — ia memakai Bearer token sendiri — sehingga foto
 * yang baru saja ia unggah selalu balas 401 saat hendak ditampilkan kembali.
 */

function permintaan(authorization?: string) {
  return { headers: authorization ? { authorization } : {} };
}

beforeEach(() => {
  verifyMobileToken.mockReset();
  getToken.mockReset();
  getToken.mockResolvedValue(null);
});

describe("punya sesi baca upload", () => {
  it("menerima token mobile yang sah", async () => {
    verifyMobileToken.mockResolvedValue({ userId: "u-1" });

    await expect(
      punyaSesiBacaUpload(permintaan("Bearer token-sah")),
    ).resolves.toBe(true);
    expect(verifyMobileToken).toHaveBeenCalledWith("token-sah");
  });

  it("menolak token mobile yang tidak sah", async () => {
    verifyMobileToken.mockResolvedValue(null);

    await expect(
      punyaSesiBacaUpload(permintaan("Bearer token-palsu")),
    ).resolves.toBe(false);
  });

  it("tetap menerima sesi web lewat cookie", async () => {
    getToken.mockResolvedValue({ id: "u-1" });

    await expect(punyaSesiBacaUpload(permintaan())).resolves.toBe(true);
    expect(verifyMobileToken).not.toHaveBeenCalled();
  });

  it("menolak permintaan tanpa sesi apa pun", async () => {
    await expect(punyaSesiBacaUpload(permintaan())).resolves.toBe(false);
  });

  // Klien yang belum login kadang mengirim string "null" apa adanya; itu bukan
  // token dan tidak boleh sampai ke verifikasi.
  it("mengabaikan Bearer kosong atau literal null", async () => {
    await expect(punyaSesiBacaUpload(permintaan("Bearer null"))).resolves.toBe(
      false,
    );
    await expect(punyaSesiBacaUpload(permintaan("Bearer "))).resolves.toBe(
      false,
    );
    expect(verifyMobileToken).not.toHaveBeenCalled();
  });

  // Verifikasi token bisa melempar (mis. Redis mati). Permintaan web yang
  // kebetulan membawa header Authorization lain tidak boleh ikut gagal total.
  it("jatuh ke cookie ketika verifikasi token melempar", async () => {
    verifyMobileToken.mockRejectedValue(new Error("redis mati"));
    getToken.mockResolvedValue({ id: "u-1" });

    await expect(
      punyaSesiBacaUpload(permintaan("Bearer token-rusak")),
    ).resolves.toBe(true);
  });

  it("mengabaikan skema selain Bearer", async () => {
    await expect(punyaSesiBacaUpload(permintaan("Basic abc"))).resolves.toBe(
      false,
    );
    expect(verifyMobileToken).not.toHaveBeenCalled();
  });
});
