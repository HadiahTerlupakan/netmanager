/**
 * Entitas domain target presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

export const BULAN_MIN = 1;
export const BULAN_MAKS = 12;

export interface PeriodeTarget {
  tahun: number;
  bulan: number;
}

export interface TargetEntity {
  id: string;
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  targetKunjungan: number;
  targetProspek: number;
  targetKonversi: number;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Angka nyata yang dicapai seorang sales pada satu periode. */
export interface RealisasiTarget {
  kunjungan: number;
  prospek: number;
  konversi: number;
}
