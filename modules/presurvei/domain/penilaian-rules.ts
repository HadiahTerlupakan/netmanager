/**
 * Aturan penilaian kinerja sales dan kepala sales — fungsi murni, tanpa I/O.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

import type { RencanaEntity } from "./entities/Rencana";
import { isLaporanTerlambat, tentukanStatusTampil } from "./rencana-rules";
import type { Pencapaian } from "./target-rules";

const PERSEN_PENUH = 100;
/** Laporan terlambat tetap dihargai, tapi hanya separuh laporan tepat waktu. */
const NILAI_TERLAMBAT = 0.5;
/** Minggu bukan hari kerja sales (getUTCDay: 0 = Minggu). */
const HARI_MINGGU = 0;

/** Satu indikator: nilai 0–100 (null = belum bisa diukur) dan bobotnya. */
export interface Indikator {
  nilai: number | null;
  bobot: number;
}

export const BOBOT_PENILAIAN_SALES = {
  aktivitas: 40,
  konversi: 30,
  realisasi: 30,
} as const;

export const BOBOT_PENILAIAN_KEPALA = {
  aktivitasTim: 30,
  konversiTim: 30,
  realisasiPenugasan: 20,
  cakupanPembinaan: 10,
  kinerjaPribadi: 10,
} as const;

export const PREDIKAT_PENILAIAN = [
  "SANGAT_BAIK",
  "BAIK",
  "CUKUP",
  "PERLU_PEMBINAAN",
] as const;
export type PredikatPenilaian = (typeof PREDIKAT_PENILAIAN)[number];

/** Ambang bawah tiap predikat, dari yang tertinggi. */
const AMBANG_PREDIKAT: readonly [PredikatPenilaian, number][] = [
  ["SANGAT_BAIK", 85],
  ["BAIK", 70],
  ["CUKUP", 55],
];

/** Predikat dari skor; skor null (belum ada yang bisa diukur) → null. */
export function tentukanPredikat(skor: number | null): PredikatPenilaian | null {
  if (skor === null) return null;
  const cocok = AMBANG_PREDIKAT.find(([, ambang]) => skor >= ambang);
  return cocok ? cocok[0] : "PERLU_PEMBINAAN";
}

/**
 * Skor tertimbang 0–100. Indikator yang belum bisa diukur (null) dikeluarkan
 * dan bobotnya dibagi ulang ke indikator lain, supaya skor tidak jatuh hanya
 * karena target belum ditetapkan. Semua null → null.
 */
export function gabungSkor(indikator: readonly Indikator[]): number | null {
  const terukur = indikator.filter(
    (item): item is { nilai: number; bobot: number } => item.nilai !== null,
  );
  const totalBobot = terukur.reduce((jumlah, item) => jumlah + item.bobot, 0);
  if (totalBobot === 0) return null;
  const total = terukur.reduce((jumlah, item) => jumlah + item.nilai * item.bobot, 0);
  return Math.round(total / totalBobot);
}

/** Rata-rata nilai yang terukur; tidak ada → null. */
export function rataRata(nilai: readonly (number | null)[]): number | null {
  const terukur = nilai.filter((item): item is number => item !== null);
  if (terukur.length === 0) return null;
  return Math.round(terukur.reduce((a, b) => a + b, 0) / terukur.length);
}

/** Aktivitas = rata-rata capaian kunjungan dan prospek baru; tanpa target → null. */
export function nilaiAktivitas(pencapaian: Pencapaian | null): number | null {
  if (!pencapaian) return null;
  return rataRata([pencapaian.kunjungan.persen, pencapaian.prospek.persen]);
}

/** Konversi = capaian target konversi; tanpa target → null. */
export function nilaiKonversi(pencapaian: Pencapaian | null): number | null {
  return pencapaian ? pencapaian.konversi.persen : null;
}

/** Rekap status rencana yang jatuh tempo (tanggal ≤ hari ini). */
export interface RekapRealisasi {
  tepatWaktu: number;
  terlambat: number;
  terlewat: number;
}

/** Hitung tepat waktu/terlambat/terlewat; rencana mendatang dan batal diabaikan. */
export function rekapRealisasi(
  daftar: readonly RencanaEntity[],
  hariIni: string,
  zonaWaktu: string,
): RekapRealisasi {
  const rekap: RekapRealisasi = { tepatWaktu: 0, terlambat: 0, terlewat: 0 };
  for (const rencana of daftar) {
    const status = tentukanStatusTampil(rencana, hariIni);
    if (status === "TERLEWAT") rekap.terlewat += 1;
    if (status !== "SELESAI") continue;
    if (isLaporanTerlambat(rencana, zonaWaktu)) rekap.terlambat += 1;
    else rekap.tepatWaktu += 1;
  }
  return rekap;
}

/** Realisasi 0–100: tepat waktu penuh, terlambat separuh, terlewat nol; tanpa jatuh tempo → null. */
export function nilaiRealisasi(rekap: RekapRealisasi): number | null {
  const jatuhTempo = rekap.tepatWaktu + rekap.terlambat + rekap.terlewat;
  if (jatuhTempo === 0) return null;
  const poin = rekap.tepatWaktu + rekap.terlambat * NILAI_TERLAMBAT;
  return Math.round((poin / jatuhTempo) * PERSEN_PENUH);
}

/**
 * Hari kerja (Senin–Sabtu) dari awal bulan sampai `sampai` (inklusif),
 * sebagai "YYYY-MM-DD". Bulan yang belum dimulai → kosong.
 */
export function hariKerjaBulan(
  tahun: number,
  bulan: number,
  sampai: string,
): string[] {
  const hasil: string[] = [];
  const tanggal = new Date(Date.UTC(tahun, bulan - 1, 1));
  while (tanggal.getUTCMonth() === bulan - 1) {
    const teks = tanggal.toISOString().slice(0, 10);
    if (teks > sampai) break;
    if (tanggal.getUTCDay() !== HARI_MINGGU) hasil.push(teks);
    tanggal.setUTCDate(tanggal.getUTCDate() + 1);
  }
  return hasil;
}

/**
 * Cakupan pembinaan 0–100: dari seluruh pasangan (anggota × hari kerja), berapa
 * persen yang punya minimal satu rencana tidak batal. Mengukur apakah kepala
 * sales memastikan tidak ada anggota yang bekerja tanpa arahan.
 */
export function nilaiCakupan(
  anggotaIds: readonly string[],
  daftar: readonly RencanaEntity[],
  hariKerja: readonly string[],
): number | null {
  const totalSlot = anggotaIds.length * hariKerja.length;
  if (totalSlot === 0) return null;
  const hariSet = new Set(hariKerja);
  const anggotaSet = new Set(anggotaIds);
  const terisi = new Set(
    daftar
      .filter(
        (rencana) =>
          rencana.status !== "BATAL" &&
          anggotaSet.has(rencana.salesId) &&
          hariSet.has(rencana.tanggal),
      )
      .map((rencana) => `${rencana.salesId}|${rencana.tanggal}`),
  );
  return Math.round((terisi.size / totalSlot) * PERSEN_PENUH);
}
