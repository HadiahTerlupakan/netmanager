/**
 * Aturan ringkasan Beranda sales mobile — fungsi murni, tanpa I/O.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain. Batas hari dan
 * bulan adalah UTC, sama dengan laporan pencapaian
 * (`services/TargetService.ts`, `bangunRentangBulan`).
 */

import { KEGIATAN_JENIS, type KegiatanJenis } from "./entities/Kegiatan";
import type { ProspekStatus } from "./entities/Prospek";
import type { PeriodeTarget } from "./entities/Target";
import type { RentangPeriode } from "./ports/IKegiatanRepository";
import { rentangTertutupUtc } from "./rentang-waktu";
import type { Pencapaian } from "./target-rules";

/** Jumlah prospek aktif terlama yang ditampilkan di Beranda. */
export const BATAS_PERLU_FOLLOW_UP = 5;

const SATU_HARI = 1;
const INDEKS_BULAN_KE_NOMOR = 1;

/** Prospek aktif beserta waktu terakhir baris prospeknya berubah. */
export interface ProspekSentuhan {
  id: string;
  nama: string;
  noTelp: string;
  status: ProspekStatus;
  updatedAt: Date;
}

/** Prospek yang perlu di-follow-up beserta waktu sentuhan terakhirnya. */
export interface ProspekPerluFollowUp {
  id: string;
  nama: string;
  noTelp: string;
  status: ProspekStatus;
  sentuhanTerakhir: Date;
}

/** Target bulan berjalan milik pemanggil beserta pencapaiannya. */
export interface TargetSendiri {
  periodeTahun: number;
  periodeBulan: number;
  pencapaian: Pencapaian;
}

/** Ringkasan Beranda sales. `target` null berarti target belum ditetapkan. */
export interface RingkasanSales {
  tanggal: Date;
  kegiatanHariIni: Record<KegiatanJenis, number>;
  target: TargetSendiri | null;
  perluFollowUp: ProspekPerluFollowUp[];
}

/** Rentang tertutup satu hari UTC yang memuat `sekarang`. */
export function rentangHariUtc(sekarang: Date): RentangPeriode {
  const mulai = new Date(
    Date.UTC(
      sekarang.getUTCFullYear(),
      sekarang.getUTCMonth(),
      sekarang.getUTCDate(),
    ),
  );
  const besok = new Date(
    Date.UTC(
      sekarang.getUTCFullYear(),
      sekarang.getUTCMonth(),
      sekarang.getUTCDate() + SATU_HARI,
    ),
  );
  return rentangTertutupUtc(mulai, besok);
}

/** Periode bulan UTC yang memuat `sekarang`, dengan bulan 1–12. */
export function periodeBulanUtc(sekarang: Date): PeriodeTarget {
  return {
    tahun: sekarang.getUTCFullYear(),
    bulan: sekarang.getUTCMonth() + INDEKS_BULAN_KE_NOMOR,
  };
}

/** Hitungan per jenis dengan nol untuk jenis yang tidak muncul di agregasi. */
export function lengkapiHitunganPerJenis(
  parsial: Partial<Record<KegiatanJenis, number>>,
): Record<KegiatanJenis, number> {
  return Object.fromEntries(
    KEGIATAN_JENIS.map((jenis) => [jenis, parsial[jenis] ?? 0]),
  ) as Record<KegiatanJenis, number>;
}

/**
 * Prospek yang paling lama tak disentuh, terlama lebih dulu, paling banyak
 * `batas`.
 *
 * "Disentuh" adalah yang lebih akhir antara perubahan baris prospek dan
 * kegiatan terakhir yang tertaut: mencatat follow-up tidak mengubah
 * `updatedAt` prospek (`services/KegiatanService.ts`, `catat`). Seri
 * diurutkan dengan id supaya urutannya stabil. Masukan tidak diubah.
 */
export function pilihPerluFollowUp(
  prospek: readonly ProspekSentuhan[],
  kegiatanTerakhir: Readonly<Record<string, Date>>,
  batas: number,
): ProspekPerluFollowUp[] {
  return prospek
    .map((baris) => ({
      id: baris.id,
      nama: baris.nama,
      noTelp: baris.noTelp,
      status: baris.status,
      sentuhanTerakhir: yangTerakhir(
        baris.updatedAt,
        kegiatanTerakhir[baris.id],
      ),
    }))
    .sort(bandingkanSentuhan)
    .slice(0, batas);
}

function yangTerakhir(diubah: Date, kegiatan: Date | undefined): Date {
  if (kegiatan === undefined) return diubah;
  return kegiatan.getTime() > diubah.getTime() ? kegiatan : diubah;
}

function bandingkanSentuhan(
  a: ProspekPerluFollowUp,
  b: ProspekPerluFollowUp,
): number {
  const selisih = a.sentuhanTerakhir.getTime() - b.sentuhanTerakhir.getTime();
  return selisih !== 0 ? selisih : a.id.localeCompare(b.id);
}
