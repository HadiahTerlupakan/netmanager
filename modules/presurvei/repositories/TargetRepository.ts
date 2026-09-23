import { prisma } from "@/modules/database";
import type { PeriodeTarget, TargetEntity } from "../domain/entities/Target";
import type {
  ITargetRepository,
  SimpanTargetInput,
} from "../domain/ports/ITargetRepository";
import { toTargetEntity, type TargetRow } from "../mappers/target.mapper";

/**
 * Akses data target presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant.
 */
export class TargetRepository implements ITargetRepository {
  /** Seluruh target pada satu periode — dipakai laporan tim. */
  async findByPeriode(periode: PeriodeTarget): Promise<TargetEntity[]> {
    const rows = await prisma.presurveiTarget.findMany({
      where: { periodeTahun: periode.tahun, periodeBulan: periode.bulan },
    });
    return rows.map((row) => toTargetEntity(row as TargetRow));
  }

  /**
   * Target seorang sales pada satu periode di satu tenant, null bila belum
   * ditetapkan.
   *
   * `tenantId` ditulis eksplisit: untuk super admin ekstensi tenant tidak
   * menyaring apa pun (`lib/prisma-extension.ts`, `isNonSuperAdminTenant`).
   */
  async findByUserPeriode(
    userId: string,
    periode: PeriodeTarget,
    tenantId: string,
  ): Promise<TargetEntity | null> {
    const row = await prisma.presurveiTarget.findFirst({
      where: {
        userId,
        periodeTahun: periode.tahun,
        periodeBulan: periode.bulan,
        tenantId,
      },
    });
    return row ? toTargetEntity(row as TargetRow) : null;
  }

  /**
   * Simpan target, menimpa yang sudah ada untuk user dan periode yang sama.
   *
   * `input.tenantId` ikut ditulis pada `create`. Untuk pemanggil biasa
   * ekstensi isolasi menimpanya dengan tenant konteks (nilainya sama); untuk
   * super admin nilai eksplisit itu yang dipakai.
   */
  async simpan(input: SimpanTargetInput): Promise<TargetEntity> {
    const adaSebelumnya = await this.findByUserPeriode(
      input.userId,
      { tahun: input.periodeTahun, bulan: input.periodeBulan },
      input.tenantId,
    );

    const row = adaSebelumnya
      ? await prisma.presurveiTarget.update({
          where: { id: adaSebelumnya.id },
          data: {
            targetKunjungan: input.targetKunjungan,
            targetProspek: input.targetProspek,
            targetKonversi: input.targetKonversi,
          },
        })
      : await prisma.presurveiTarget.create({ data: input });

    return toTargetEntity(row as TargetRow);
  }
}
