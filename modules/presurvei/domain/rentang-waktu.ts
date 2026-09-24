import type { RentangPeriode } from "./ports/IKegiatanRepository";

/**
 * Bantuan rentang tertutup UTC — fungsi murni, tanpa I/O.
 *
 * Baik ringkasan Beranda (`rentangHariUtc`, hari) maupun laporan pencapaian
 * bulanan (`services/TargetService.ts`, `bangunRentangBulan`, bulan)
 * membangun rentang tertutup dengan pola sama: awal inklusif pada unit
 * waktu, akhir satu milidetik sebelum unit berikutnya dimulai. Satu helper
 * di sini menghindari dua angka "-1" yang bisa diam-diam berbeda.
 */

/** Satu milidetik — batas akhir rentang tertutup ada tepat sebelum unit berikutnya. */
export const SATU_MILIDETIK = 1;

/** Rentang tertutup dari `mulai` (inklusif) sampai tepat sebelum `akhirEksklusif`. */
export function rentangTertutupUtc(
  mulai: Date,
  akhirEksklusif: Date,
): RentangPeriode {
  return {
    mulai,
    selesai: new Date(akhirEksklusif.getTime() - SATU_MILIDETIK),
  };
}
