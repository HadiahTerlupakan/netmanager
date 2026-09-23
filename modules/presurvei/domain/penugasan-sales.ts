/**
 * Aturan penugasan sales pada baris presurvei — target dan pemilik prospek.
 *
 * Satu definisi untuk keduanya: baris milik satu tenant hanya boleh menunjuk
 * sales tenant yang sama. Tanpa aturan ini, `userId` dari tenant lain lolos
 * begitu saja karena foreign key ke `User` tidak mengenal tenant.
 */

/** Fakta seorang user yang menentukan apakah ia boleh ditugasi baris presurvei. */
export interface CalonSales {
  id: string;
  tenantId: string | null;
  isSales: boolean;
  isActive: boolean;
}

/** Syarat tambahan yang bergantung pada jenis penugasannya. */
export interface SyaratPenugasan {
  /**
   * Penugasan BARU (pemilik prospek berganti, target baru) menuntut sales
   * aktif. Mengubah target yang sudah ada tidak — sales yang dinonaktifkan di
   * tengah bulan tetap harus bisa dikoreksi targetnya.
   */
  isWajibAktif: boolean;
}

/**
 * Apakah `calon` boleh ditugasi baris bertenant `tenantBaris`.
 *
 * Tenant baris yang kosong selalu ditolak: tanpa penjaga itu, user bertenant
 * null lolos perbandingan `null === null`.
 */
export function isCalonSalesSah(
  calon: CalonSales | null,
  tenantBaris: string | null,
  syarat: SyaratPenugasan,
): boolean {
  if (!calon || !tenantBaris) return false;
  if (calon.tenantId !== tenantBaris) return false;
  if (!calon.isSales) return false;
  return !syarat.isWajibAktif || calon.isActive;
}
