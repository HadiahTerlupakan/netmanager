import type { PeriodeTarget, TargetEntity } from "../entities/Target";

/**
 * Kontrak akses data target presurvei.
 */

export interface SimpanTargetInput {
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  targetKunjungan: number;
  targetProspek: number;
  targetKonversi: number;
}

export interface ITargetRepository {
  /** Seluruh target pada satu periode — dipakai laporan tim. */
  findByPeriode(periode: PeriodeTarget): Promise<TargetEntity[]>;
  findByUserPeriode(
    userId: string,
    periode: PeriodeTarget,
  ): Promise<TargetEntity | null>;
  /** Simpan target, menimpa yang sudah ada untuk user dan periode yang sama. */
  simpan(input: SimpanTargetInput): Promise<TargetEntity>;
}
