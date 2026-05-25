import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface CustomerCohortEntity {
  id: string;
  cohortMonth: number;
  cohortYear: number;
  initialCustomers: number;
  month0Revenue: bigint;
  month1Revenue: bigint;
  month2Revenue: bigint;
  month3Revenue: bigint;
  month6Revenue: bigint;
  month12Revenue: bigint;
  activeMonth0: number;
  activeMonth1: number;
  activeMonth3: number;
  activeMonth6: number;
  activeMonth12: number;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
}

const CHECKPOINTS = [0, 1, 3, 6, 12] as const;
type Checkpoint = (typeof CHECKPOINTS)[number];

/**
 * Service compute & save customer cohort retention.
 *
 * Cohort = pelanggan yang aktivasi di (year, month) tertentu.
 * Untuk tiap cohort, hitung berapa yang masih AKTIF di bulan ke-0/1/3/6/12
 * dan total revenue (sum harga paket) per checkpoint.
 *
 * Catatan: kalau bulan checkpoint masih di masa depan (mis. cohort baru
 * 2 bulan lalu, month12 belum tercapai), nilai 0 dipertahankan dan akan
 * di-update saat cron berikutnya jalan.
 */
export class CustomerCohortService {
  /** Compute & save semua cohort untuk N bulan terakhir. */
  async computeAndSaveAll(monthsBack = 12): Promise<{
    cohortsProcessed: number;
    timestamp: Date;
  }> {
    const now = new Date();
    let processed = 0;

    for (let offset = 0; offset <= monthsBack; offset++) {
      const target = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const cohortYear = target.getFullYear();
      const cohortMonth = target.getMonth() + 1;

      try {
        await this.computeCohort(cohortYear, cohortMonth, now);
        processed++;
      } catch (error) {
        logger.error(
          `[CustomerCohort] Failed cohort ${cohortYear}-${cohortMonth}:`,
          error,
        );
      }
    }

    logger.info(`[CustomerCohort] Processed ${processed} cohorts`);
    return { cohortsProcessed: processed, timestamp: now };
  }

  /** Hitung & upsert satu cohort. */
  async computeCohort(
    cohortYear: number,
    cohortMonth: number,
    now = new Date(),
  ): Promise<CustomerCohortEntity> {
    const cohortStart = new Date(cohortYear, cohortMonth - 1, 1);
    const cohortEnd = new Date(cohortYear, cohortMonth, 1);

    const cohortPelanggan = await prisma.pelanggan.findMany({
      where: {
        tanggalAktif: { gte: cohortStart, lt: cohortEnd },
      },
      select: {
        id: true,
        status: true,
        tanggalAktif: true,
        hargaPaket: { select: { harga: true } },
      },
    });

    const initialCustomers = cohortPelanggan.length;
    const activeByCheckpoint: Record<Checkpoint, number> = {
      0: 0,
      1: 0,
      3: 0,
      6: 0,
      12: 0,
    };
    const revenueByCheckpoint: Record<Checkpoint, bigint> = {
      0: 0n,
      1: 0n,
      3: 0n,
      6: 0n,
      12: 0n,
    };

    for (const p of cohortPelanggan) {
      const monthlyRevenue = BigInt(p.hargaPaket.harga);

      for (const cp of CHECKPOINTS) {
        const checkpointDate = new Date(cohortYear, cohortMonth - 1 + cp, 1);
        if (checkpointDate > now) continue;

        if (this.isAssumedActiveAtCheckpoint(p.status, cp)) {
          activeByCheckpoint[cp]++;
          revenueByCheckpoint[cp] += monthlyRevenue;
        }
      }
    }

    const data = {
      cohortYear,
      cohortMonth,
      initialCustomers,
      month0Revenue: revenueByCheckpoint[0],
      month1Revenue: revenueByCheckpoint[1],
      month2Revenue: 0n,
      month3Revenue: revenueByCheckpoint[3],
      month6Revenue: revenueByCheckpoint[6],
      month12Revenue: revenueByCheckpoint[12],
      activeMonth0: activeByCheckpoint[0],
      activeMonth1: activeByCheckpoint[1],
      activeMonth3: activeByCheckpoint[3],
      activeMonth6: activeByCheckpoint[6],
      activeMonth12: activeByCheckpoint[12],
      updatedAt: now,
    };

    return prisma.customerCohort.upsert({
      where: { cohortYear_cohortMonth: { cohortYear, cohortMonth } },
      create: { id: globalThis.crypto.randomUUID(), ...data },
      update: data,
    });
  }

  /** Ambil semua cohort untuk dashboard. */
  async getAllCohorts(monthsBack = 12): Promise<CustomerCohortEntity[]> {
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

    return prisma.customerCohort.findMany({
      where: {
        OR: [
          { cohortYear: { gt: since.getFullYear() } },
          {
            cohortYear: since.getFullYear(),
            cohortMonth: { gte: since.getMonth() + 1 },
          },
        ],
      },
      orderBy: [{ cohortYear: "desc" }, { cohortMonth: "desc" }],
    });
  }

  /**
   * Heuristic apakah pelanggan dianggap aktif di checkpoint tertentu.
   *
   * MVP simple: status AKTIF = active di semua checkpoint yang sudah lewat.
   * Status non-AKTIF = sudah churn → asumsi tidak aktif di checkpoint manapun
   * yang sudah lewat (snapshot retention saat ini, bukan reconstruct historis).
   *
   * Untuk akurasi historis penuh perlu trace MRRMovement per pelanggan
   * (CHURN/REACTIVATION events) — bisa di-iterate nanti.
   */
  private isAssumedActiveAtCheckpoint(
    status: string,
    _checkpoint: Checkpoint,
  ): boolean {
    return status === "AKTIF";
  }
}

let instance: CustomerCohortService | null = null;

export function getCustomerCohortService(): CustomerCohortService {
  instance ??= new CustomerCohortService();
  return instance;
}
