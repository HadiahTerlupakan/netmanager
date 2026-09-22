import { describe, expect, it } from "vitest";

/**
 * `laporanPeriodeSchema` adalah satu-satunya penjaga batas bulan untuk
 * laporan pencapaian — `TargetService.laporanPencapaian` tidak memvalidasi
 * periodenya sendiri. `bulan: 0` diam-diam menghasilkan rentang Desember
 * tahun sebelumnya di `Date.UTC`, dan `bulan: 13` Januari tahun berikutnya:
 * laporannya tampil normal, angkanya wajar, periodenya salah.
 */

import {
  laporanPeriodeSchema,
  tetapkanTargetSchema,
} from "@/modules/presurvei/validators/target.validator";

const masukanTarget = (over: Record<string, unknown> = {}) => ({
  userId: "sales-1",
  periodeTahun: 2026,
  periodeBulan: 9,
  targetKunjungan: 20,
  targetProspek: 11,
  targetKonversi: 6,
  ...over,
});

describe("tetapkanTargetSchema — batas bulan", () => {
  it("menolak bulan 0", () => {
    expect(
      tetapkanTargetSchema.safeParse(masukanTarget({ periodeBulan: 0 }))
        .success,
    ).toBe(false);
  });

  it("menolak bulan 13", () => {
    expect(
      tetapkanTargetSchema.safeParse(masukanTarget({ periodeBulan: 13 }))
        .success,
    ).toBe(false);
  });

  it("menerima bulan 1 dan bulan 12, batas sah paling ekstrem", () => {
    expect(
      tetapkanTargetSchema.safeParse(masukanTarget({ periodeBulan: 1 }))
        .success,
    ).toBe(true);
    expect(
      tetapkanTargetSchema.safeParse(masukanTarget({ periodeBulan: 12 }))
        .success,
    ).toBe(true);
  });
});

describe("tetapkanTargetSchema — target negatif", () => {
  it("menolak targetKunjungan negatif", () => {
    expect(
      tetapkanTargetSchema.safeParse(masukanTarget({ targetKunjungan: -1 }))
        .success,
    ).toBe(false);
  });

  it("menerima target nol, bukan hanya positif", () => {
    // Target nol itu sah — domain menganggapnya tercapai penuh (Task 11),
    // bukan kasus yang harus ditolak validator.
    expect(
      tetapkanTargetSchema.safeParse(
        masukanTarget({
          targetKunjungan: 0,
          targetProspek: 0,
          targetKonversi: 0,
        }),
      ).success,
    ).toBe(true);
  });
});

describe("laporanPeriodeSchema", () => {
  it("menolak bulan 0", () => {
    expect(
      laporanPeriodeSchema.safeParse({ tahun: 2026, bulan: 0 }).success,
    ).toBe(false);
  });

  it("menolak bulan 13", () => {
    expect(
      laporanPeriodeSchema.safeParse({ tahun: 2026, bulan: 13 }).success,
    ).toBe(false);
  });

  it("menerima angka berbentuk string dari query parameter", () => {
    // Nilainya datang dari query string HTTP, jadi selalu string mentah.
    // Tanpa z.coerce, "2026"/"9" akan ditolak sebagai bukan number.
    const hasil = laporanPeriodeSchema.safeParse({
      tahun: "2026",
      bulan: "9",
    });

    expect(hasil.success).toBe(true);
    if (hasil.success) {
      expect(hasil.data).toEqual({ tahun: 2026, bulan: 9 });
    }
  });
});
