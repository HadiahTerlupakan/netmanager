import type { Status } from "@prisma/client";
import { prisma } from "@/modules/database";
import {
  createDatabaseUsageAccumulator,
  mapDatabaseHistoryItem,
  mapUsageSortBy,
  type ParsedDateRange,
  type UsageSource,
  type UsageSortBy,
} from "./pelanggan-ppp-route-helpers";

const MAX_LIMIT = 100;

export const BASIC_CUSTOMER_SELECT = {
  id: true,
  idPelanggan: true,
  nama: true,
  username: true,
  status: true,
  tenantId: true,
  catatan: true,
} as const;

export type DatabaseUsageStatsInput = {
  pelangganId: string;
  startDate: Date;
  endDate: Date;
};

export type DatabaseHistoryInput = {
  pelangganId: string;
  source: UsageSource;
  sortBy: UsageSortBy;
  sortOrder: "asc" | "desc";
  dateRange: ParsedDateRange;
};

/** Cari pelanggan untuk route usage PPP. */
export function findUsageCustomer(input: {
  id: string;
  tenantId?: string | null;
}) {
  return prisma.pelanggan.findFirst({
    where: {
      id: input.id,
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    },
    select: BASIC_CUSTOMER_SELECT,
  });
}

/** Hitung agregat usage database pelanggan. */
export async function getDatabaseUsageStats(input: DatabaseUsageStatsInput) {
  const customerUsage = await prisma.customerUsage.findMany({
    where: buildUsageStatsWhere(input),
    orderBy: { session_start_time: "desc" },
    take: MAX_LIMIT,
  });
  return customerUsage.reduce(
    reduceUsageStats,
    createDatabaseUsageAccumulator(),
  );
}

/** Ambil histori usage database pelanggan. */
export async function getDatabaseHistory(input: DatabaseHistoryInput) {
  if (input.source === "radius") return [];
  const usageRecords = await prisma.customerUsage.findMany({
    where: buildDatabaseHistoryWhere(input),
    orderBy: { [mapUsageSortBy(input.sortBy)]: input.sortOrder },
  });
  return usageRecords.map(mapDatabaseHistoryItem);
}

/** Ambil pelanggan untuk lifecycle PPP. */
export function findPelangganForLifecycle(id: string) {
  return prisma.pelanggan.findUnique({
    where: { id },
    include: { hargaPaket: { include: { bandwidth: true } } },
  });
}

/** Update status pelanggan melalui service utama. */
export type UpdateCustomerStatusInput = {
  id: string;
  status: Status;
};

function buildUsageStatsWhere(input: DatabaseUsageStatsInput) {
  return {
    pelangganId: input.pelangganId,
    session_start_time: {
      gte: input.startDate,
      lte: input.endDate,
    },
  };
}

function reduceUsageStats(
  acc: ReturnType<typeof createDatabaseUsageAccumulator>,
  usage: {
    session_duration: bigint | number | null;
    upload_bytes: bigint | number | null;
    download_bytes: bigint | number | null;
    total_bytes: bigint | number | null;
  },
) {
  return {
    totalSessionTime:
      acc.totalSessionTime + BigInt(usage.session_duration ?? 0),
    totalUploadBytes: acc.totalUploadBytes + BigInt(usage.upload_bytes ?? 0),
    totalDownloadBytes:
      acc.totalDownloadBytes + BigInt(usage.download_bytes ?? 0),
    totalBytes: acc.totalBytes + BigInt(usage.total_bytes ?? 0),
    sessionCount: acc.sessionCount + 1,
  };
}

function buildDatabaseHistoryWhere(input: DatabaseHistoryInput) {
  return {
    pelangganId: input.pelangganId,
    ...buildSessionStartTimeFilter(input.dateRange),
  };
}

function buildSessionStartTimeFilter(dateRange: ParsedDateRange) {
  if (!dateRange.startDate && !dateRange.endDate) return {};
  return {
    session_start_time: {
      ...(dateRange.startDate ? { gte: dateRange.startDate } : {}),
      ...(dateRange.endDate ? { lte: dateRange.endDate } : {}),
    },
  };
}
