import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getMRRMovementService } from "./MRRMovementService";

export type SnapshotType = "DAILY" | "WEEKLY" | "MONTHLY";

export interface RevenueSnapshotData {
  snapshotDate: Date;
  snapshotType: SnapshotType;
  totalMRR: bigint;
  totalARR: bigint;
  newMRR: bigint;
  expansionMRR: bigint;
  contractionMRR: bigint;
  churnMRR: bigint;
  reactivationMRR: bigint;
  activeCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  arpu: number;
  tenantId?: string | null;
}

export interface RevenueSnapshotEntity extends Omit<
  RevenueSnapshotData,
  "snapshotType"
> {
  id: string;
  snapshotType: string;
  createdAt: Date;
}

/**
 * Service compute & save snapshot revenue (MRR/ARR) per periode.
 *
 * Sumber data:
 * - MRR Movements bulan berjalan dari `MRRMovementService.getMonthSummary()`
 * - Total MRR = sum harga paket dari `Pelanggan` aktif
 * - Active customers = count pelanggan status AKTIF
 * - ARPU = totalMRR / activeCustomers
 * - ARR = totalMRR * 12
 */
export class RevenueSnapshotService {
  constructor(private readonly mrrService = getMRRMovementService()) {}

  /** Compute & save snapshot harian. */
  async computeAndSave(now = new Date()): Promise<RevenueSnapshotEntity> {
    const snapshotDate = startOfDay(now);
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const movements = await this.mrrService.getMonthSummary(year, month);
    const totals = await this.computeBaseline();

    const movementBuckets = bucketMovements(movements);

    const arpu =
      totals.activeCustomers > 0
        ? Number(totals.totalMRR / BigInt(totals.activeCustomers))
        : 0;

    const data: RevenueSnapshotData = {
      snapshotDate,
      snapshotType: "DAILY",
      totalMRR: totals.totalMRR,
      totalARR: totals.totalMRR * 12n,
      newMRR: movementBuckets.NEW,
      expansionMRR: movementBuckets.EXPANSION,
      contractionMRR: movementBuckets.CONTRACTION,
      churnMRR: movementBuckets.CHURN,
      reactivationMRR: movementBuckets.REACTIVATION,
      activeCustomers: totals.activeCustomers,
      newCustomers: bucketCounts(movements).NEW,
      churnedCustomers: bucketCounts(movements).CHURN,
      arpu,
    };

    const saved = await prisma.revenueSnapshot.upsert({
      where: {
        snapshotDate_snapshotType: {
          snapshotDate,
          snapshotType: "DAILY",
        },
      },
      create: { id: globalThis.crypto.randomUUID(), ...data },
      update: data,
    });

    logger.info(
      `[RevenueSnapshot] Saved DAILY ${snapshotDate.toISOString()} | MRR ${totals.totalMRR} | active ${totals.activeCustomers}`,
    );

    return saved;
  }

  /** Ambil snapshot terbaru. */
  async getLatest(
    snapshotType: SnapshotType = "DAILY",
  ): Promise<RevenueSnapshotEntity | null> {
    return prisma.revenueSnapshot.findFirst({
      where: { snapshotType },
      orderBy: { snapshotDate: "desc" },
    });
  }

  /** Ambil history N hari terakhir untuk trend chart. */
  async getHistory(days = 30): Promise<RevenueSnapshotEntity[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return prisma.revenueSnapshot.findMany({
      where: {
        snapshotType: "DAILY",
        snapshotDate: { gte: since },
      },
      orderBy: { snapshotDate: "asc" },
    });
  }

  /** Hitung total MRR dari paket aktif & jumlah pelanggan aktif. */
  private async computeBaseline(): Promise<{
    totalMRR: bigint;
    activeCustomers: number;
  }> {
    const activePelanggan = await prisma.pelanggan.findMany({
      where: { status: "AKTIF" },
      select: { hargaPaket: { select: { harga: true } } },
    });

    const totalMRR = activePelanggan.reduce(
      (acc, p) => acc + BigInt(p.hargaPaket.harga),
      0n,
    );

    return {
      totalMRR,
      activeCustomers: activePelanggan.length,
    };
  }
}

interface MRRMovementSummary {
  movementType: "NEW" | "EXPANSION" | "CONTRACTION" | "CHURN" | "REACTIVATION";
  totalAmount: bigint;
  count: number;
}

function bucketMovements(rows: MRRMovementSummary[]) {
  const buckets = {
    NEW: 0n,
    EXPANSION: 0n,
    CONTRACTION: 0n,
    CHURN: 0n,
    REACTIVATION: 0n,
  };

  for (const row of rows) {
    buckets[row.movementType] += row.totalAmount;
  }

  return buckets;
}

function bucketCounts(rows: MRRMovementSummary[]) {
  const counts = {
    NEW: 0,
    EXPANSION: 0,
    CONTRACTION: 0,
    CHURN: 0,
    REACTIVATION: 0,
  };

  for (const row of rows) {
    counts[row.movementType] += row.count;
  }

  return counts;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

let instance: RevenueSnapshotService | null = null;

export function getRevenueSnapshotService(): RevenueSnapshotService {
  instance ??= new RevenueSnapshotService();
  return instance;
}
