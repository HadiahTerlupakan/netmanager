import { describe, expect, it } from "vitest";
import {
  isBolehLihatSemuaPresurvei,
  isKepalaSalesDariIzin,
  jenisLingkupDariIzin,
  jenisLingkupPenilaian,
} from "@/modules/roles/domain/lingkup-presurvei";

/**
 * Keputusan akses presurvei dari permission. Semuanya menjaga kontrol akses —
 * bukan sekadar menyaring tampilan — jadi pelonggarannya tidak boleh terjadi
 * diam-diam.
 */

describe("jenisLingkupDariIzin", () => {
  it.each([
    [["m_presurvei:read"], "SENDIRI"],
    [["presurvei_rencana:read", "presurvei_rencana:create"], "TIM"],
    [["presurvei_rencana:read", "presurvei_rencana:view_all"], "SEMUA"],
    [["*"], "SEMUA"],
    // Permission presurvei web lain TIDAK membuka rencana orang lain.
    [["presurvei:read", "m_presurvei:read"], "SENDIRI"],
  ])("%j → %s", (izin, harapan) => {
    expect(jenisLingkupDariIzin(izin)).toBe(harapan);
  });
});

describe("jenisLingkupPenilaian", () => {
  it.each([
    [["m_presurvei:read"], "SENDIRI"],
    [["presurvei_rencana:create"], "TIM"],
    [["presurvei_rencana:read", "presurvei_rencana:view_all"], "SEMUA"],
    [["presurvei_laporan:read"], "SEMUA"],
    [["*"], "SEMUA"],
  ])("%j → %s", (izin, harapan) => {
    expect(jenisLingkupPenilaian(izin)).toBe(harapan);
  });
});

/**
 * Lingkup TIM berarti berwenang menugaskan, bukan sekadar boleh melihat.
 * Sebelumnya awalan `presurvei_rencana:` apa pun sudah dihitung TIM, sehingga
 * role ber-`:read` saja mendapat tema dan tombol kepala sales padahal
 * penugasannya pasti ditolak 403.
 */
describe("lingkup TIM menuntut wewenang menugaskan", () => {
  it.each([
    ["presurvei_rencana:read"],
    ["presurvei_rencana:update"],
    ["presurvei_rencana:delete"],
    ["presurvei_rencana:cancel"],
  ])("%s saja belum menjadikan kepala sales", (izin) => {
    expect(jenisLingkupDariIzin([izin])).toBe("SENDIRI");
    expect(isKepalaSalesDariIzin([izin])).toBe(false);
  });

  it("presurvei_rencana:create menjadikan kepala sales", () => {
    expect(jenisLingkupDariIzin(["presurvei_rencana:create"])).toBe("TIM");
    expect(isKepalaSalesDariIzin(["presurvei_rencana:create"])).toBe(true);
  });

  it("view_all tetap mengungguli create (admin melihat seluruh tenant)", () => {
    expect(
      jenisLingkupDariIzin([
        "presurvei_rencana:create",
        "presurvei_rencana:view_all",
      ]),
    ).toBe("SEMUA");
  });
});

describe("isKepalaSalesDariIzin", () => {
  it("izin rencana tanpa view_all menandai kepala sales (lingkup TIM)", () => {
    expect(
      isKepalaSalesDariIzin([
        "presurvei_rencana:read",
        "presurvei_rencana:create",
        "m_presurvei:read",
      ]),
    ).toBe(true);
  });

  it("admin (lingkup SEMUA) dan teknisi bukan kepala sales", () => {
    expect(isKepalaSalesDariIzin(["*"])).toBe(false);
    expect(
      isKepalaSalesDariIzin([
        "presurvei_rencana:read",
        "presurvei_rencana:view_all",
      ]),
    ).toBe(false);
    expect(
      isKepalaSalesDariIzin(["m_work_order:read", "m_canvasing:read"]),
    ).toBe(false);
  });
});

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
