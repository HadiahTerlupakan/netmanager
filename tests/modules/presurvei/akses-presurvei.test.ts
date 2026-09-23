import { describe, expect, it } from "vitest";

/**
 * Penurunan kapabilitas pemanggil route presurvei.
 *
 * Keempat route menerima permission web ATAU mobile, jadi lolosnya gerbang
 * permission belum berarti pemanggil boleh menyentuh milik orang lain. Dua
 * fungsi di sini yang membedakannya, dan keduanya menjaga kontrol akses —
 * bukan sekadar menyaring tampilan. Berkas ini yang membuat pelonggarannya
 * tidak bisa terjadi diam-diam.
 */

import {
  ikatFilterProspekKePemanggil,
  isBolehLihatSemuaPresurvei,
  isMenugaskanPemilik,
  tentukanPemilikProspek,
} from "@/app/api/presurvei/akses-presurvei";

const ID_PEMANGGIL = "sales-a";
const ID_ORANG_LAIN = "sales-b";

describe("isBolehLihatSemuaPresurvei", () => {
  it("mengizinkan pemegang permission web", () => {
    expect(isBolehLihatSemuaPresurvei(["presurvei:read"])).toBe(true);
  });

  it("mengizinkan super admin lewat wildcard", () => {
    expect(isBolehLihatSemuaPresurvei(["*"])).toBe(true);
  });

  it("menolak pemegang permission mobile saja", () => {
    expect(
      isBolehLihatSemuaPresurvei([
        "m_presurvei:read",
        "m_presurvei:create",
        "m_presurvei:update",
      ]),
    ).toBe(false);
  });

  it("menolak daftar permission kosong", () => {
    expect(isBolehLihatSemuaPresurvei([])).toBe(false);
  });

  it("tidak tertipu permission mobile yang namanya memuat nama permission web", () => {
    // Pemeriksaan harus atas keanggotaan daftar, bukan pencocokan substring.
    expect(isBolehLihatSemuaPresurvei(["m_presurvei:read"])).toBe(false);
  });
});

describe("tentukanPemilikProspek", () => {
  it("mengabaikan pemilik kiriman klien saat pemanggil hanya punya permission mobile", () => {
    // Inilah inti perbaikannya: `pemilikId` menentukan siapa boleh membaca dan
    // mengubah prospek, jadi sales tidak boleh menugaskannya ke orang lain.
    const hasil = tentukanPemilikProspek(
      ["m_presurvei:create"],
      ID_ORANG_LAIN,
      ID_PEMANGGIL,
    );

    expect(hasil).toBe(ID_PEMANGGIL);
  });

  it("menghormati pemilik kiriman klien saat pemanggil punya permission web", () => {
    const hasil = tentukanPemilikProspek(
      ["presurvei:read", "presurvei:create"],
      ID_ORANG_LAIN,
      ID_PEMANGGIL,
    );

    expect(hasil).toBe(ID_ORANG_LAIN);
  });

  it("jatuh ke pemanggil saat pemilik tidak disertakan", () => {
    expect(
      tentukanPemilikProspek(["presurvei:read"], undefined, ID_PEMANGGIL),
    ).toBe(ID_PEMANGGIL);
    expect(tentukanPemilikProspek(["presurvei:read"], null, ID_PEMANGGIL)).toBe(
      ID_PEMANGGIL,
    );
  });

  it("mengembalikan pemanggil untuk permission mobile meski pemilik tidak disertakan", () => {
    expect(
      tentukanPemilikProspek(["m_presurvei:create"], undefined, ID_PEMANGGIL),
    ).toBe(ID_PEMANGGIL);
  });

  it("tidak pernah mengembalikan nilai kosong", () => {
    // Nilai kosong akan melahirkan prospek tanpa pemilik — tak terlihat oleh
    // sales mana pun dan hanya bisa dipulihkan lewat panel admin.
    for (const permissions of [
      ["m_presurvei:create"],
      ["presurvei:read"],
      [],
    ]) {
      expect(
        tentukanPemilikProspek(permissions, null, ID_PEMANGGIL),
      ).toBeTruthy();
    }
  });
});

describe("ikatFilterProspekKePemanggil", () => {
  it("menimpa pemilik dan membuang tanpaPemilik", () => {
    const filter = Object.freeze({
      pemilikId: ID_ORANG_LAIN,
      tanpaPemilik: true,
      page: 2,
      limit: 7,
    });

    const hasil = ikatFilterProspekKePemanggil(filter, ID_PEMANGGIL);

    expect(hasil).toEqual({ pemilikId: ID_PEMANGGIL, page: 2, limit: 7 });
    expect(hasil).not.toHaveProperty("tanpaPemilik");
  });
});

describe("isMenugaskanPemilik", () => {
  it("benar hanya untuk pemegang permission web yang mengirim pemilik", () => {
    expect(isMenugaskanPemilik(["presurvei:read"], ID_ORANG_LAIN)).toBe(true);
    expect(isMenugaskanPemilik(["*"], ID_ORANG_LAIN)).toBe(true);
  });

  it("salah bila pemilik tidak dikirim — pemilik jatuh ke pemanggil", () => {
    expect(isMenugaskanPemilik(["presurvei:read"], undefined)).toBe(false);
    expect(isMenugaskanPemilik(["presurvei:read"], null)).toBe(false);
    expect(isMenugaskanPemilik(["presurvei:read"], "")).toBe(false);
  });

  it("salah untuk pemegang permission mobile, yang pemiliknya diabaikan", () => {
    expect(isMenugaskanPemilik(["m_presurvei:create"], ID_ORANG_LAIN)).toBe(
      false,
    );
  });
});
