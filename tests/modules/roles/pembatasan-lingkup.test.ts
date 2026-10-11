import { describe, expect, it } from "vitest";

import { getResourceCapabilities } from "@/lib/resource-capabilities";
import {
  buangPembatasanTanpaToggle,
  isPembatasanPunyaToggle,
} from "@/modules/roles/domain/pembatasan-lingkup";

/**
 * Katalog kapabilitas disuntikkan, bukan diimpor oleh domain — lapisan domain
 * tidak boleh bergantung pada `lib/`. Tes memakai katalog yang sebenarnya,
 * sehingga ia tetap menguji perilaku terhadap data produksi, bukan tiruan.
 */
const katalog = getResourceCapabilities;

/**
 * Pembatasan yang tidak punya toggle di halaman Hak Akses tidak boleh tersimpan:
 * pemiliknya tidak bisa melihatnya, apalagi mematikannya, dan setiap
 * penyimpanan role menuliskannya ulang sehingga ia abadi.
 *
 * Yang dijaga ketat di sini: penjaga hanya menyentuh aksi PEMBATASAN. Membuang
 * kemampuan yang kebetulan tidak ada di katalog akan mencabut izin yang sah —
 * matriks mobile memakai daftar aksi yang berbeda.
 */

describe("pembatasan tanpa toggle", () => {
  it("meneruskan pembatasan yang punya toggle", () => {
    expect(isPembatasanPunyaToggle("site:site_only", katalog)).toBe(true);
    expect(isPembatasanPunyaToggle("workorders:site_only", katalog)).toBe(true);
  });

  it("membuang pembatasan yang tidak punya toggle", () => {
    // Katalog `site` memuat site_only, tetapi tidak department_only.
    expect(isPembatasanPunyaToggle("site:department_only", katalog)).toBe(
      false,
    );
    expect(isPembatasanPunyaToggle("m_absensi:department_only", katalog)).toBe(
      false,
    );
  });

  it("tidak menyentuh kemampuan, termasuk yang di luar katalog", () => {
    for (const izin of [
      "site:read",
      "m_absensi:cancel",
      "salary:mark_paid",
      "resource_antah_berantah:update",
    ]) {
      expect(isPembatasanPunyaToggle(izin, katalog)).toBe(true);
    }
  });

  it("menyaring daftar tanpa mengubah urutan sisanya", () => {
    expect(
      buangPembatasanTanpaToggle(
        [
          "site:read",
          "site:department_only",
          "site:site_only",
          "m_izin:department_only",
          "users:read",
        ],
        katalog,
      ),
    ).toEqual(["site:read", "site:site_only", "users:read"]);
  });

  it("izin berbentuk aneh dibiarkan, bukan ditebak", () => {
    expect(
      buangPembatasanTanpaToggle(["", "tanpa-titik-dua"], katalog),
    ).toEqual(["", "tanpa-titik-dua"]);
  });
});
