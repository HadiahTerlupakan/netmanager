import { describe, expect, it } from "vitest";

import {
  namaBulan,
  paramPeriode,
  periodeSekarang,
  pilihanBulan,
  pilihanTahun,
} from "@/app/admin/presurvei/periode";

describe("paramPeriode", () => {
  it("memakai nama param `tahun` dan `bulan` yang dibaca `laporanPeriodeSchema`", () => {
    // Satu pembentuk untuk route target dan laporan: keduanya membaca
    // `searchParams.get("tahun")`/`get("bulan")`
    // (`app/api/admin/presurvei/target/route.ts:17-20`,
    // `app/api/admin/presurvei/laporan/route.ts:16-19`).
    expect(paramPeriode({ tahun: 2026, bulan: 9 })).toBe("tahun=2026&bulan=9");
  });
});

describe("periodeSekarang", () => {
  it("mengembalikan bulan kalender berjalan, bukan indeks nol", () => {
    // `Date.getMonth()` mengembalikan 0 untuk Januari. Meneruskannya apa
    // adanya membuat Januari ditolak validator yang menuntut minimal 1.
    const periode = periodeSekarang(new Date("2026-01-15T00:00:00.000Z"));

    expect(periode).toEqual({ tahun: 2026, bulan: 1 });
  });

  it("mengembalikan Desember sebagai bulan dua belas", () => {
    expect(periodeSekarang(new Date("2026-12-31T23:00:00.000Z"))).toEqual({
      tahun: 2026,
      bulan: 12,
    });
  });

  it("memakai kalender UTC, sama dengan batas bulan di server", () => {
    // Pilihan sadar, bukan kelalaian: `TargetService.ts:85-95` menghitung
    // batas bulan dengan `Date.UTC`. Pukul 02:00 WIB tanggal 1 Oktober masih
    // 30 September di UTC, jadi periodenya September.
    //
    // Test ini bergantung pada `process.env.TZ = "Asia/Jakarta"` di
    // `tests/setup.ts`: di sana `getMonth()` lokal menghasilkan Oktober, dan
    // itulah yang membuat penggantian ke kalender lokal merah di sini.
    expect(periodeSekarang(new Date("2026-10-01T02:00:00+07:00"))).toEqual({
      tahun: 2026,
      bulan: 9,
    });
  });
});

describe("pilihanTahun", () => {
  it("menawarkan dua tahun ke belakang sampai satu tahun ke depan", () => {
    expect(pilihanTahun(2026)).toEqual([2024, 2025, 2026, 2027]);
  });

  it("mengembalikan array baru di setiap panggilan", () => {
    const pertama = pilihanTahun(2026);
    pertama.reverse();

    expect(pilihanTahun(2026)).toEqual([2024, 2025, 2026, 2027]);
  });
});

describe("pilihanBulan", () => {
  it("menawarkan bulan 1 sampai 12, bukan indeks nol", () => {
    expect(pilihanBulan()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("namaBulan", () => {
  it("memberi nama bulan berbahasa Indonesia dari nomor 1–12", () => {
    expect(namaBulan(1)).toBe("Januari");
    expect(namaBulan(12)).toBe("Desember");
  });
});
