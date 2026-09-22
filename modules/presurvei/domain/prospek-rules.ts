import type { ProspekEntity, ProspekStatus } from "./entities/Prospek";

/**
 * Aturan bisnis prospek presurvei — fungsi murni, tanpa I/O.
 *
 * Ditaruh terpisah dari service supaya bisa diuji tanpa database dan supaya
 * satu-satunya definisi "kapan prospek boleh pindah status" tidak tersebar.
 */

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
