import { prisma } from "@/lib/prisma";
import { Prisma, type AttendanceStatus } from "@prisma/client";
import {
  appendActiveAttendanceRawFilter,
  buildActiveAttendanceWhere,
  resolveEffectiveTenantId,
} from "./attendance-repository-helpers";

export class AttendanceReportRankingRepository {
  /** Ambil statistik attendance berdasarkan site atau department. */
  async getGroupedStats(
    startDate: Date,
    endDate: Date,
    groupBy: "department" | "site",
    tenantId?: string,
  ) {
    const userStats = await this.getGroupedUserStats(
      startDate,
      endDate,
      tenantId,
    );
    if (userStats.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: userStats.map((stat) => stat.userId) } },
      select: {
        id: true,
        siteId: true,
        departmentId: true,
        sites: { select: { name: true } },
        departments: { select: { name: true } },
      },
    });
    const groupMap = new Map<
      string,
      { id: string; name: string; present: number; late: number; total: number }
    >();

    userStats.forEach((stat) => {
      const user = users.find((candidate) => candidate.id === stat.userId);
      if (!user) return;
      const groupId = groupBy === "site" ? user.siteId : user.departmentId;
      const groupName =
        groupBy === "site" ? user.sites?.name : user.departments?.name;
      if (!groupId) return;
      const group = this.ensureGroup(groupMap, groupId, groupName || "Unknown");
      group.present += stat.present;
      group.late += stat.late;
      group.total += stat.total;
    });

    return Array.from(groupMap.values());
  }

  /** Ambil user dengan attendance hadir terbanyak. */
  async getTopEmployees(
    startDate: Date,
    endDate: Date,
    limit = 5,
    siteId?: string,
    departmentId?: string,
  ) {
    const userIds = await this.findScopedUserIds(siteId, departmentId, false);
    if (userIds?.length === 0) return [];
    return this.getTopUsers(
      startDate,
      endDate,
      limit,
      ["ON_TIME", "LATE"],
      userIds,
    );
  }

  /** Ambil user fixed-hour dengan alpha/absent terbanyak. */
  async getTopAbsentees(
    startDate: Date,
    endDate: Date,
    limit = 5,
    siteId?: string,
    departmentId?: string,
  ) {
    const userIds = await this.findScopedUserIds(siteId, departmentId, true);
    if (userIds?.length === 0) return [];
    return this.getTopUsers(
      startDate,
      endDate,
      limit,
      ["ALPHA", "ABSENT"],
      userIds,
    );
  }

  private async getGroupedUserStats(
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ) {
    const { effectiveTenantId, isSuperAdmin } =
      await resolveEffectiveTenantId(tenantId);
    let query = Prisma.sql`
      SELECT
        a."userId",
        COUNT(CASE WHEN a.status IN ('ON_TIME', 'LATE') THEN 1 END)::int as present,
        COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late,
        COUNT(*)::int as total
      FROM "Attendance" a
      WHERE a."checkIn" >= ${startDate}
      AND a."checkIn" <= ${endDate}
      ${!isSuperAdmin ? Prisma.sql`AND a."tenantId" = ${effectiveTenantId}` : Prisma.empty}
    `;
    query = appendActiveAttendanceRawFilter(query);
    query = Prisma.sql`${query} GROUP BY a."userId"`;
    return prisma.$queryRaw<
      { userId: string; present: number; late: number; total: number }[]
    >(query);
  }

  private ensureGroup(
    groupMap: Map<
      string,
      { id: string; name: string; present: number; late: number; total: number }
    >,
    groupId: string,
    groupName: string,
  ) {
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, {
        id: groupId,
        name: groupName,
        present: 0,
        late: 0,
        total: 0,
      });
    }
    return groupMap.get(groupId)!;
  }

  private async findScopedUserIds(
    siteId: string | undefined,
    departmentId: string | undefined,
    fixedHourOnly: boolean,
  ) {
    if (!siteId && !departmentId && !fixedHourOnly) return undefined;
    const users = await prisma.user.findMany({
      where: {
        ...(fixedHourOnly ? { workingHourMode: { not: "FLEXIBLE" } } : {}),
        ...(siteId && { siteId }),
        ...(departmentId && { departmentId }),
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  private async getTopUsers(
    startDate: Date,
    endDate: Date,
    limit: number,
    statuses: AttendanceStatus[],
    userIds?: string[],
  ) {
    const groups = await prisma.attendance.groupBy({
      by: ["userId"],
      where: buildActiveAttendanceWhere({
        checkIn: { gte: startDate, lte: endDate },
        status: { in: statuses },
        ...(userIds !== undefined && { userId: { in: userIds } }),
      }),
      _count: { _all: true },
    });
    groups.sort((first, second) => second._count._all - first._count._all);
    const topGroups = groups.slice(0, limit);
    if (topGroups.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: topGroups.map((group) => group.userId) } },
      select: {
        id: true,
        name: true,
        image: true,
        sites: { select: { name: true } },
        departments: { select: { name: true } },
      },
    });
    return topGroups
      .map((group) => ({
        user: users.find((user) => user.id === group.userId),
        count: group._count._all,
      }))
      .filter((item) => item.user != null);
  }
}
