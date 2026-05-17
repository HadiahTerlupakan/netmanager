import type { ProratePaymentLog } from "@prisma/client";
import { prisma } from "@/modules/database";

export type ProrateLogRecord = ProratePaymentLog;

export interface ProrateLogQueryFilter {
  pelangganId: string;
  /** Bila tenantId disediakan, query di-scope ke tenant tersebut. */
  tenantId?: string;
  /** Maksimum hasil yang dikembalikan. */
  limit: number;
}

/**
 * Cari pelanggan ringkas dalam scope tenant aktif.
 * Tenant-agnostic bila `tenantId` undefined (super admin).
 */
export async function findPelangganBasic(params: {
  pelangganId: string;
  tenantId?: string;
}): Promise<{ id: string; nama: string } | null> {
  const where: Record<string, unknown> = { id: params.pelangganId };
  if (params.tenantId) where.tenantId = params.tenantId;

  return prisma.pelanggan.findFirst({
    where,
    select: { id: true, nama: true },
  });
}

/**
 * Ambil riwayat prorate payment log untuk pelanggan tertentu, urut terbaru.
 */
export async function findProrateLogs(
  filter: ProrateLogQueryFilter,
): Promise<ProrateLogRecord[]> {
  const where: Record<string, unknown> = { pelangganId: filter.pelangganId };
  if (filter.tenantId) where.tenantId = filter.tenantId;

  return prisma.proratePaymentLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filter.limit,
  });
}
