import type { PeriodeTarget, TargetEntity } from "../entities/Target";

/**
 * Kontrak akses data target presurvei.
 */

/** Isi target sebagaimana ditetapkan pemakai — tanpa tenant. */
export interface DataTarget {
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  targetKunjungan: number;
  targetProspek: number;
  targetKonversi: number;
}

/**
 * Target yang siap ditulis. `tenantId` wajib dan ditulis eksplisit: untuk
 * super admin tanpa tenant sesi, ekstensi tenant tidak mengisinya
 * (`lib/prisma-extension.ts`), dan target tanpa tenant hilang dari laporan.
 */
export interface SimpanTargetInput extends DataTarget {
  tenantId: string;
}

export interface ITargetRepository {
  /** Seluruh target pada satu periode — dipakai laporan tim. */
  findByPeriode(periode: PeriodeTarget): Promise<TargetEntity[]>;
  /** Target seorang sales pada satu periode di satu tenant, null bila belum ada. */
  findByUserPeriode(
    userId: string,
    periode: PeriodeTarget,
    tenantId: string,
  ): Promise<TargetEntity | null>;
  /** Simpan target, menimpa yang sudah ada untuk user dan periode yang sama. */
  simpan(input: SimpanTargetInput): Promise<TargetEntity>;
}
