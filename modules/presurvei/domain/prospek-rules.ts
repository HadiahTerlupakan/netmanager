import type {
  ProspekEntity,
  ProspekStatus,
  ProspekSumber,
} from "./entities/Prospek";

/**
 * Aturan bisnis prospek presurvei — fungsi murni, tanpa I/O.
 *
 * Ditaruh terpisah dari service supaya bisa diuji tanpa database dan supaya
 * satu-satunya definisi "kapan prospek boleh pindah status" tidak tersebar.
 */

const SUMBER_BERASAL_IKLAN: ProspekSumber[] = ["IKLAN"];
const SUMBER_BERASAL_REFERRAL: ProspekSumber[] = ["REFERRAL"];

/** Apakah sumber prospek ini harus menunjuk ke sebuah kampanye iklan. */
export function isSumberButuhIklan(sumber: ProspekSumber): boolean {
  return SUMBER_BERASAL_IKLAN.includes(sumber);
}

/** Apakah sumber prospek ini harus mencatat nama perujuknya. */
export function isSumberButuhReferral(sumber: ProspekSumber): boolean {
  return SUMBER_BERASAL_REFERRAL.includes(sumber);
}

const TRANSISI_SAH: Record<ProspekStatus, readonly ProspekStatus[]> = {
  BARU: ["DIHUBUNGI", "TIDAK_MINAT"],
  DIHUBUNGI: ["TERTARIK", "TIDAK_MINAT", "TIDAK_LAYAK"],
  TERTARIK: ["NEGOSIASI", "TIDAK_MINAT", "TIDAK_LAYAK"],
  NEGOSIASI: ["DEAL", "TIDAK_MINAT", "TIDAK_LAYAK"],
  DEAL: [],
  TIDAK_MINAT: ["DIHUBUNGI"],
  TIDAK_LAYAK: [],
};

/**
 * Daftar status yang boleh dituju dari status saat ini.
 *
 * Mengembalikan salinan, bukan array aslinya: server berjalan sebagai proses
 * panjang, jadi satu pemanggil yang memutasi hasilnya — `.sort()` untuk
 * menampilkan dropdown sudah cukup — akan merusak tabel transisi bagi seluruh
 * tenant selama proses itu hidup.
 */
export function getStatusLanjutan(status: ProspekStatus): ProspekStatus[] {
  return [...TRANSISI_SAH[status]];
}

/** Apakah perpindahan status prospek diizinkan aturan funnel. */
export function isTransisiStatusSah(
  dari: ProspekStatus,
  ke: ProspekStatus,
): boolean {
  return TRANSISI_SAH[dari].includes(ke);
}

/** Apakah prospek sudah mencapai akhir perjalanannya dan tidak bisa berubah lagi. */
export function isStatusFinal(status: ProspekStatus): boolean {
  return TRANSISI_SAH[status].length === 0;
}

/**
 * Status yang masih menuntut kerja dari sales pemiliknya.
 *
 * Sengaja TIDAK diturunkan dari `isStatusFinal`: yang itu menjawab "masih bisa
 * pindah status", dan TIDAK_MINAT masih bisa (kembali ke DIHUBUNGI bila
 * pelanggan berubah pikiran) padahal tidak lagi menuntut kerja. Meminjamnya
 * membuat prospek mati ikut terhitung sebagai beban.
 */
const STATUS_BEBAN_AKTIF: readonly ProspekStatus[] = [
  "BARU",
  "DIHUBUNGI",
  "TERTARIK",
  "NEGOSIASI",
];

/** Apakah status ini masih menuntut kerja dari sales pemiliknya. */
export function isStatusBebanAktif(status: ProspekStatus): boolean {
  return STATUS_BEBAN_AKTIF.includes(status);
}

/** Salinan daftar status beban aktif, untuk dipakai sebagai filter query. */
export function daftarStatusBebanAktif(): ProspekStatus[] {
  return [...STATUS_BEBAN_AKTIF];
}

/**
 * Apakah prospek siap dipromosikan menjadi canvasing.
 *
 * Syaratnya: sudah DEAL, belum pernah dipromosikan, dan data minimal untuk
 * membuat canvasing sudah terisi.
 */
export function canPromosikanKeCanvasing(
  prospek: Pick<ProspekEntity, "status" | "canvasingId" | "noTelp" | "alamat">,
): boolean {
  if (prospek.status !== "DEAL") return false;
  if (prospek.canvasingId) return false;
  if (prospek.noTelp.trim().length === 0) return false;
  if (prospek.alamat.trim().length === 0) return false;
  return true;
}
