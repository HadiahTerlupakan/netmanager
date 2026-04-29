import { Prisma } from "@prisma/client";
import { getTenantIdFromContext } from "@/lib/tenant-context";

const MISSING_TENANT_ID = "___MISSING_TENANT_ID___";
const EMPTY_STATUS_COUNTS: Record<string, number> = {};
const EMPTY_STATS = {
  total: 0,
  avgDurationMinutes: 0,
  statusCounts: EMPTY_STATUS_COUNTS,
};
const ACTIVE_EXCLUDED_STATUSES = [
  "ALPHA",
  "ABSENT",
  "DAY_OFF",
  "PERMIT",
  "SICK",
] as const;

/** Tambahkan filter attendance aktif yang belum dikoreksi. */
export function buildActiveAttendanceWhere(
  where: Prisma.AttendanceWhereInput,
): Prisma.AttendanceWhereInput {
  return {
    ...where,
    correctedAt: null,
  };
}

/** Tambahkan filter correctedAt null ke raw SQL attendance. */
export function appendActiveAttendanceRawFilter(query: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`${query} AND a."correctedAt" IS NULL`;
}

/** Normalisasi hasil query user menjadi daftar user id. */
export function mapUsersToIds(users: Array<{ id: string }>): string[] {
  return users.map((user) => user.id);
}

/** Ambil tenant efektif dari context atau override explicit. */
export async function resolveEffectiveTenantId(
  tenantId?: string,
): Promise<{ effectiveTenantId?: string; isSuperAdmin: boolean }> {
  const { tenantId: contextTenantId, isSuperAdmin } =
    await getTenantIdFromContext();
  return {
    effectiveTenantId:
      tenantId ??
      (!isSuperAdmin && !contextTenantId ? MISSING_TENANT_ID : contextTenantId),
    isSuperAdmin,
  };
}

/** Kembalikan payload statistik kosong yang konsisten. */
export function createEmptyStatsResult() {
  return EMPTY_STATS;
}

/** Cek apakah koleksi user id hasil filter kosong. */
export function hasNoUserIds(userIds?: string[]): boolean {
  return Array.isArray(userIds) && userIds.length === 0;
}

/** Ambil daftar status attendance yang dikecualikan dari sesi aktif. */
export function getInactiveSessionStatuses() {
  return ACTIVE_EXCLUDED_STATUSES;
}

/** Ubah hasil groupBy status menjadi map count. */
export function toStatusCountMap<T extends { _count: { _all: number } }>(
  rows: T[],
  getKey: (row: T) => string | null,
): Record<string, number> {
  return rows.reduce<Record<string, number>>((accumulator, row) => {
    const key = getKey(row);
    if (key) accumulator[key] = row._count._all;
    return accumulator;
  }, {});
}
