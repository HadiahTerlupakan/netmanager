import type { TargetEntity } from "../domain/entities/Target";

/**
 * Pemetaan baris Prisma ke entitas domain target.
 */

export interface TargetRow {
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

/** Ubah satu baris target dari database menjadi entitas domain. */
export function toTargetEntity(row: TargetRow): TargetEntity {
  return {
    id: row.id,
    userId: row.userId,
    periodeTahun: row.periodeTahun,
    periodeBulan: row.periodeBulan,
    targetKunjungan: row.targetKunjungan,
    targetProspek: row.targetProspek,
    targetKonversi: row.targetKonversi,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
