import type { TargetEntity } from "../domain/entities/Target";
import type { BarisLaporan } from "../services/TargetService";

/**
 * Bentuk data target yang dikirim ke klien.
 */

export interface TargetDto {
  id: string;
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  targetKunjungan: number;
  targetProspek: number;
  targetKonversi: number;
  updatedAt: string;
}

export interface BarisLaporanDto {
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  kunjungan: { target: number; tercapai: number; persen: number };
  prospek: { target: number; tercapai: number; persen: number };
  konversi: { target: number; tercapai: number; persen: number };
}

/** Bentuk target untuk klien. */
export function toTargetDto(target: TargetEntity): TargetDto {
  return {
    id: target.id,
    userId: target.userId,
    periodeTahun: target.periodeTahun,
    periodeBulan: target.periodeBulan,
    targetKunjungan: target.targetKunjungan,
    targetProspek: target.targetProspek,
    targetKonversi: target.targetKonversi,
    updatedAt: target.updatedAt.toISOString(),
  };
}

/** Bentuk satu baris laporan pencapaian untuk klien. */
export function toBarisLaporanDto(baris: BarisLaporan): BarisLaporanDto {
  return {
    userId: baris.userId,
    periodeTahun: baris.periodeTahun,
    periodeBulan: baris.periodeBulan,
    kunjungan: baris.pencapaian.kunjungan,
    prospek: baris.pencapaian.prospek,
    konversi: baris.pencapaian.konversi,
  };
}
