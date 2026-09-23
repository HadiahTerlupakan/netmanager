import {
  PROSPEK_STATUS_CONFIG,
  type ProspekListItemDto,
  type ProspekStatus,
} from "@/modules/presurvei/client";

/**
 * Pemberitahuan saat kartu dijatuhkan ke DEAL.
 *
 * DEAL menuntut data pelanggan yang tidak ada pada prospek
 * (`modules/presurvei/domain/prospek-kanban.ts:44-48`), dan formulir
 * konversinya belum dibangun (Task 14). Jatuhan ke DEAL tetap memberi umpan
 * balik alih-alih diam, dan tidak menulis status apa pun.
 */
export const PESAN_KONVERSI_BELUM_TERSEDIA =
  "Memindahkan prospek ke Deal butuh formulir konversi, yang belum tersedia di papan ini. Status prospek tidak diubah.";

/** URL `PATCH` satu prospek (`app/api/presurvei/prospek/[id]/route.ts`). */
export function buildUbahProspekUrl(prospekId: string): string {
  return `/api/presurvei/prospek/${encodeURIComponent(prospekId)}`;
}

/** Apakah kartu `prospekId` ada di salah satu halaman yang sudah dimuat. */
export function isKartuTermuat(
  perHalaman: (ProspekListItemDto[] | undefined)[],
  prospekId: string,
): boolean {
  return perHalaman.some((halaman) =>
    (halaman ?? []).some((item) => item.id === prospekId),
  );
}

/**
 * Pesan setelah status prospek berhasil dipindah.
 *
 * `isTermuat` false berarti kartunya tidak tampil di kolom tujuan: kolom
 * diurutkan `createdAt desc`, bukan waktu pindah
 * (`modules/presurvei/repositories/ProspekRepository.ts:41-43`), jadi prospek
 * lama bisa mendarat di halaman yang belum dimuat, atau kolom tujuannya sedang
 * disembunyikan. Tanpa pesan berbeda kartu lenyap dari kedua kolom dan pemakai
 * mengira pemindahannya gagal.
 */
export function pesanSetelahPindah(
  tujuan: ProspekStatus,
  isTermuat: boolean,
): string {
  const label = PROSPEK_STATUS_CONFIG[tujuan].label;
  if (isTermuat) return `Prospek dipindah ke ${label}`;
  return `Prospek dipindah ke ${label}. Kartunya tidak tampil karena berada di luar kartu yang sudah dimuat kolom ${label}.`;
}
