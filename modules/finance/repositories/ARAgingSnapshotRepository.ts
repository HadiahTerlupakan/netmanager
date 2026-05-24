import { prisma } from "@/lib/prisma";

export interface ARAgingSnapshotData {
  current: bigint;
  overdue30: bigint;
  overdue60: bigint;
  overdue90: bigint;
  totalOutstanding: bigint;
  totalCustomers: number;
  tenantId?: string | null;
}

export interface ARAgingSnapshotEntity {
  id: string;
  snapshotDate: Date;
  current: bigint;
  overdue30: bigint;
  overdue60: bigint;
  overdue90: bigint;
  totalOutstanding: bigint;
  totalCustomers: number;
  createdAt: Date;
  tenantId: string | null;
}

/** Repository untuk persisten snapshot AR Aging di main DB. */
export class ARAgingSnapshotRepository {
  /** Simpan snapshot harian. */
  async save(data: ARAgingSnapshotData): Promise<ARAgingSnapshotEntity> {
    return prisma.aRAgingSnapshot.create({
      data: {
        id: globalThis.crypto.randomUUID(),
        snapshotDate: new Date(),
        current: data.current,
        overdue30: data.overdue30,
        overdue60: data.overdue60,
        overdue90: data.overdue90,
        totalOutstanding: data.totalOutstanding,
        totalCustomers: data.totalCustomers,
        tenantId: data.tenantId ?? null,
      },
    });
  }

  /** Ambil snapshot terbaru. */
  async findLatest(
    tenantId?: string | null,
  ): Promise<ARAgingSnapshotEntity | null> {
    return prisma.aRAgingSnapshot.findFirst({
      where: tenantId !== undefined ? { tenantId } : {},
      orderBy: { snapshotDate: "desc" },
    });
  }

  /** Ambil snapshot history untuk trend chart. */
  async findRange(
    days: number,
    tenantId?: string | null,
  ): Promise<ARAgingSnapshotEntity[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return prisma.aRAgingSnapshot.findMany({
      where: {
        snapshotDate: { gte: since },
        ...(tenantId !== undefined ? { tenantId } : {}),
      },
      orderBy: { snapshotDate: "asc" },
    });
  }
}

let instance: ARAgingSnapshotRepository | null = null;

export function getARAgingSnapshotRepository(): ARAgingSnapshotRepository {
  instance ??= new ARAgingSnapshotRepository();
  return instance;
}
