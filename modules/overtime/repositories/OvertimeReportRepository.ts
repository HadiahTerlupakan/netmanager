import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { getTimezone } from "@/lib/utils/get-timezone";

import type { OvertimeSiteFilter } from "../domain/ports/IOvertimeRepository";
import {
  buildReportedOvertimeWhere,
  REPORTED_OVERTIME_STATUS,
} from "./OvertimeRepository.helpers";

const DEFAULT_TOP_EMPLOYEES_LIMIT = 5;

type TenantContext = Awaited<ReturnType<typeof getTenantIdFromContext>>;
type DailyStatsRow = { date: string; requests: number; duration: number };
type GroupedStatsRow = { name: string; requests: number; duration: number };
type GroupedDuration = { userId: string; _sum: { duration: number | null } };
type TopEmployeeUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  siteId: string | null;
  departmentId: string | null;
  sites: { name: string } | null;
  departments: { name: string } | null;
};

/** Menangani query report overtime berbasis agregasi dan raw SQL. */
export class OvertimeReportRepository {
  /** Ambil agregasi overtime dalam rentang tanggal. */
  async getStatsByDateRange(input: {
    startDate: Date;
    endDate: Date;
    siteId?: OvertimeSiteFilter;
    departmentId?: string;
    tenantId?: string;
  }) {
    const stats = await prisma.overtime.aggregate({
      _count: { _all: true },
      _sum: { duration: true },
      where: buildReportedOvertimeWhere(input),
    });

    return {
      totalRequests: stats._count._all,
      totalDuration: stats._sum.duration || 0,
    };
  }

  /** Ambil statistik overtime harian. */
  async getDailyStats(input: {
    startDate: Date;
    endDate: Date;
    siteId?: OvertimeSiteFilter;
    departmentId?: string;
  }) {
    const tenantContext = await getTenantIdFromContext();
    const timezone = await getTimezone(tenantContext.tenantId ?? undefined);
    const query = buildDailyStatsQuery({ ...input, tenantContext, timezone });
    const stats = await prisma.$queryRaw<DailyStatsRow[]>(query);

    return stats
      .map(mapStatsRow)
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  /**
   * Ambil statistik overtime terkelompok. `siteId`/`departmentId` membatasi
   * pegawai yang dihitung — tanpanya admin ber-`site_only` melihat angka
   * lembur seluruh site di grafik laporan.
   */
  async getGroupedStats(input: {
    startDate: Date;
    endDate: Date;
    groupBy: "department" | "site";
    siteId?: OvertimeSiteFilter;
    departmentId?: string;
  }) {
    const tenantContext = await getTenantIdFromContext();
    const query = buildGroupedStatsQuery({ ...input, tenantContext });
    const stats = await prisma.$queryRaw<GroupedStatsRow[]>(query);

    return stats.map(mapStatsRow);
  }

  /** Ambil pegawai dengan total lembur tertinggi. */
  async getTopEmployees(input: {
    startDate: Date;
    endDate: Date;
    limit?: number;
    siteId?: OvertimeSiteFilter;
    departmentId?: string;
  }) {
    const groups = await prisma.overtime.groupBy({
      by: ["userId"],
      where: buildReportedOvertimeWhere(input),
      _sum: { duration: true },
    });
    const topGroups = groups
      .sort(sortByDurationDesc)
      .slice(0, input.limit ?? DEFAULT_TOP_EMPLOYEES_LIMIT);
    const users = await findTopEmployeeUsers(topGroups);
    const usersById = new Map(users.map((user) => [user.id, user]));

    return topGroups
      .map((group) => mapTopEmployee(group, usersById))
      .filter((item): item is NonNullable<typeof item> => item != null);
  }

  /** Ambil total durasi overtime per user. */
  async getUserOvertimeStats(input: {
    startDate: Date;
    endDate: Date;
    siteId?: OvertimeSiteFilter;
    departmentId?: string;
  }) {
    const groups = await prisma.overtime.groupBy({
      by: ["userId"],
      where: buildReportedOvertimeWhere(input),
      _sum: { duration: true },
    });

    return groups.map((group) => ({
      userId: group.userId,
      totalDuration: group._sum.duration || 0,
    }));
  }
}

function buildDailyStatsQuery(input: {
  startDate: Date;
  endDate: Date;
  siteId?: OvertimeSiteFilter;
  departmentId?: string;
  tenantContext: TenantContext;
  timezone: string;
}) {
  const dateKey = buildLocalDateKeySql(input.timezone);
  const baseQuery = createDailyStatsBaseQuery(input, dateKey);
  const scopedQuery = appendDailyStatsFilters(baseQuery, input);

  // GROUP BY 1: ekspresi tanggal memakai parameter zona waktu; mengulangnya
  // di GROUP BY menjadi parameter lain yang ditolak PostgreSQL (42803).
  return Prisma.sql`${scopedQuery} GROUP BY 1`;
}

/**
 * Tanggal lokal tenant dari `startTime`. Kolom disimpan sebagai UTC tanpa zona;
 * `TO_CHAR` langsung memberi tanggal UTC, sehingga lembur sebelum jam 07.00 WIB
 * jatuh ke hari sebelumnya.
 */
function buildLocalDateKeySql(timezone: string) {
  return Prisma.sql`TO_CHAR((o."startTime" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD')`;
}

/** Kondisi lembur yang dihitung laporan, sama dengan `buildReportedOvertimeWhere`. */
function buildReportedOvertimeSql(startDate: Date, endDate: Date) {
  return Prisma.sql`
    o.status = ${REPORTED_OVERTIME_STATUS}::"OvertimeStatus"
    AND o."startTime" >= ${startDate}
    AND o."startTime" <= ${endDate}
  `;
}

function createDailyStatsBaseQuery(
  input: {
    startDate: Date;
    endDate: Date;
    siteId?: OvertimeSiteFilter;
    departmentId?: string;
  },
  dateKey: Prisma.Sql,
) {
  const joinUserTable = input.siteId || input.departmentId;

  return Prisma.sql`
    SELECT
      ${dateKey} as date,
      COUNT(*)::int as requests,
      COALESCE(SUM(o.duration), 0)::int as duration
    FROM "Overtime" o
    ${joinUserTable ? Prisma.sql`JOIN "User" u ON o."userId" = u.id` : Prisma.empty}
    WHERE ${buildReportedOvertimeSql(input.startDate, input.endDate)}
  `;
}

function appendDailyStatsFilters(
  query: Prisma.Sql,
  input: {
    siteId?: OvertimeSiteFilter;
    departmentId?: string;
    tenantContext: TenantContext;
  },
) {
  const tenantFilter = buildTenantFilter(input.tenantContext);
  const withTenant = Prisma.sql`${query}${tenantFilter}`;
  const withSite = input.siteId
    ? Prisma.sql`${withTenant} ${buildUserSiteCondition(input.siteId)}`
    : withTenant;

  return input.departmentId
    ? Prisma.sql`${withSite} AND u."departmentId" = ${input.departmentId}`
    : withSite;
}

function buildGroupedStatsQuery(input: {
  startDate: Date;
  endDate: Date;
  groupBy: "department" | "site";
  siteId?: OvertimeSiteFilter;
  departmentId?: string;
  tenantContext: TenantContext;
}) {
  const grouping = getGroupedStatsConfig(input.groupBy);
  return Prisma.sql`
    ${createGroupedStatsSelect(grouping)}
    WHERE ${buildReportedOvertimeSql(input.startDate, input.endDate)}
    ${buildTenantFilter(input.tenantContext)}
    ${input.siteId ? buildUserSiteCondition(input.siteId) : Prisma.empty}
    ${input.departmentId ? Prisma.sql`AND u."departmentId" = ${input.departmentId}` : Prisma.empty}
    GROUP BY ${grouping.groupByColumn}, ${grouping.nameColumn}
  `;
}

function createGroupedStatsSelect(
  grouping: ReturnType<typeof getGroupedStatsConfig>,
) {
  return Prisma.sql`
    SELECT
      ${grouping.nameColumn} as name,
      COUNT(*)::int as requests,
      COALESCE(SUM(o.duration), 0)::int as duration
    FROM "Overtime" o
    JOIN "User" u ON o."userId" = u.id
    ${grouping.joinTable}
  `;
}

function getGroupedStatsConfig(groupBy: "department" | "site") {
  if (groupBy === "site") {
    return {
      groupByColumn: Prisma.sql`u."siteId"`,
      nameColumn: Prisma.sql`s.name`,
      joinTable: Prisma.sql`JOIN "sites" s ON u."siteId" = s.id`,
    };
  }

  return {
    groupByColumn: Prisma.sql`u."departmentId"`,
    nameColumn: Prisma.sql`d.name`,
    joinTable: Prisma.sql`JOIN "departments" d ON u."departmentId" = d.id`,
  };
}

/**
 * Klausa `AND u."siteId" ...` untuk raw SQL report: satu site → `=`, daftar
 * site → `IN` terparameter. Daftar kosong menjadi `AND FALSE` — gagal tertutup,
 * dan `Prisma.join([])` sendiri akan menghasilkan SQL tidak valid.
 */
export function buildUserSiteCondition(siteFilter: OvertimeSiteFilter) {
  if (typeof siteFilter === "string") {
    return Prisma.sql`AND u."siteId" = ${siteFilter}`;
  }
  if (siteFilter.in.length === 0) return Prisma.sql`AND FALSE`;
  return Prisma.sql`AND u."siteId" IN (${Prisma.join(siteFilter.in)})`;
}

function buildTenantFilter(tenantContext: TenantContext) {
  if (tenantContext.isSuperAdmin) {
    return Prisma.empty;
  }

  return Prisma.sql`AND o."tenantId" = ${requireTenantId(tenantContext)}`;
}

function requireTenantId(tenantContext: TenantContext) {
  if (tenantContext.tenantId) {
    return tenantContext.tenantId;
  }

  throw new Error("Tenant context is required for overtime report access");
}

function sortByDurationDesc(
  left: { _sum: { duration: number | null } },
  right: { _sum: { duration: number | null } },
) {
  return (right._sum.duration || 0) - (left._sum.duration || 0);
}

async function findTopEmployeeUsers(groups: GroupedDuration[]) {
  if (groups.length === 0) {
    return [];
  }

  return prisma.user.findMany({
    where: { id: { in: groups.map((group) => group.userId) } },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      siteId: true,
      departmentId: true,
      sites: { select: { name: true } },
      departments: { select: { name: true } },
    },
  });
}

function mapStatsRow<T extends DailyStatsRow | GroupedStatsRow>(item: T) {
  return {
    ...item,
    requests: Number(item.requests),
    duration: Number(item.duration || 0),
  };
}

function mapTopEmployee(
  group: GroupedDuration,
  usersById: Map<string, TopEmployeeUser>,
) {
  const user = usersById.get(group.userId);
  if (!user) {
    return null;
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      siteId: user.siteId,
      departmentId: user.departmentId,
      siteName: user.sites?.name ?? null,
      departmentName: user.departments?.name ?? null,
    },
    totalDuration: group._sum.duration || 0,
  };
}
