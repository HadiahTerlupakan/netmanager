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

  /** Target seorang sales pada satu periode, null bila belum ditetapkan. */
  async findByUserPeriode(
    userId: string,
    periode: PeriodeTarget,
  ): Promise<TargetEntity | null> {
    const row = await prisma.presurveiTarget.findFirst({
      where: {
        userId,
        periodeTahun: periode.tahun,
        periodeBulan: periode.bulan,
      },
    });
    return row ? toTargetEntity(row as TargetRow) : null;
  }

  /**
   * Simpan target, menimpa yang sudah ada untuk user dan periode yang sama.
   *
   * Memakai cari-lalu-tulis alih-alih `upsert`: batasan uniknya menyertakan
   * `tenantId`, dan nilai itu diisi ekstensi isolasi — bukan oleh pemanggil —
   * sehingga tidak bisa disusun menjadi kunci `where` yang utuh di sini.
   */
  async simpan(input: SimpanTargetInput): Promise<TargetEntity> {
    const adaSebelumnya = await this.findByUserPeriode(input.userId, {
      tahun: input.periodeTahun,
      bulan: input.periodeBulan,
    });

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
