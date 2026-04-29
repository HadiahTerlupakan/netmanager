import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { HolidayRepository } from "./HolidayRepository";
import {
  appendActiveAttendanceRawFilter,
  buildActiveAttendanceWhere,
  createEmptyStatsResult,
  hasNoUserIds,
  mapUsersToIds,
  resolveEffectiveTenantId,
  toStatusCountMap,
} from "./attendance-repository-helpers";

export class AttendanceReportRepository {
  async getStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    let userIds: string[] | undefined = undefined;
    if (siteId || departmentId) {
      const users = await prisma.user.findMany({
        where: {
          ...(siteId && { siteId }),
          ...(departmentId && { departmentId }),
        },
        select: { id: true },
      });
      userIds = mapUsersToIds(users);
      if (hasNoUserIds(userIds)) {
        return createEmptyStatsResult();
      }
    }

    const where = buildActiveAttendanceWhere({
      checkIn: { gte: startDate, lte: endDate },
      ...(userIds !== undefined && { userId: { in: userIds } }),
    });

    const statusCounts = await prisma.attendance.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    const total = await prisma.attendance.count({ where });
    const { effectiveTenantId } = await resolveEffectiveTenantId();

    let query = Prisma.sql`
            SELECT
                AVG(EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn")) / 60)::float as "avgDuration"
            FROM "Attendance" a
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
            AND a."checkOut" IS NOT NULL
        `;

    if (effectiveTenantId) {
      query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`;
    }

    query = appendActiveAttendanceRawFilter(query);

    if (userIds !== undefined) {
      query = Prisma.sql`${query} AND a."userId" IN (${Prisma.join(userIds)})`;
    }

    const avgResult = await prisma.$queryRaw<{ avgDuration: number }[]>(query);

    const avgDurationMinutes = avgResult[0]?.avgDuration
      ? Math.round(avgResult[0].avgDuration)
      : 0;

    return {
      total,
      avgDurationMinutes,
      statusCounts: toStatusCountMap(statusCounts, (row) => row.status),
    };
  }

  async getEvaluationStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    let userIds: string[] | undefined = undefined;
    if (siteId || departmentId) {
      const users = await prisma.user.findMany({
        where: {
          ...(siteId && { siteId }),
          ...(departmentId && { departmentId }),
        },
        select: { id: true },
      });
      userIds = mapUsersToIds(users);
      if (hasNoUserIds(userIds)) {
        return createEmptyStatsResult();
      }
    }

    const where = {
      workDate: { gte: startDate, lte: endDate },
      ...(userIds !== undefined ? { userId: { in: userIds } } : {}),
    };

    const [statusCounts, total, avgWorkMinutes] = await Promise.all([
      prisma.attendanceEvaluation.groupBy({
        by: ["finalStatus"],
        where,
        _count: { _all: true },
      }),
      prisma.attendanceEvaluation.count({ where }),
      prisma.attendanceEvaluation.aggregate({
        where,
        _avg: { workMinutes: true },
      }),
    ]);

    return {
      total,
      avgDurationMinutes: avgWorkMinutes._avg.workMinutes
        ? Math.round(avgWorkMinutes._avg.workMinutes)
        : 0,
      statusCounts: toStatusCountMap(statusCounts, (row) => row.finalStatus),
    };
  }

  async getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    const { effectiveTenantId } = await resolveEffectiveTenantId(tenantId);

    let userIds: string[] | undefined = undefined;
    if (siteId || departmentId) {
      const users = await prisma.user.findMany({
        where: {
          ...(siteId && { siteId }),
          ...(departmentId && { departmentId }),
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);

      if (userIds.length === 0) {
        return [];
      }
    }

    let query = Prisma.sql`
            SELECT
                TO_CHAR(a."checkIn", 'YYYY-MM-DD') as date,
                COUNT(CASE WHEN a.status IN ('ON_TIME', 'LATE') THEN 1 END)::int as present,
                COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late
            FROM "Attendance" a
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
        `;

    if (effectiveTenantId) {
      query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`;
    }

    query = appendActiveAttendanceRawFilter(query);

    if (userIds !== undefined) {
      query = Prisma.sql`${query} AND a."userId" IN (${Prisma.join(userIds)})`;
    }

    query = Prisma.sql`${query} GROUP BY TO_CHAR(a."checkIn", 'YYYY-MM-DD')`;

    const attendanceStats =
      await prisma.$queryRaw<{ date: string; present: number; late: number }[]>(
        query,
      );

    const holidayRepo = new HolidayRepository();
    const holidays = await holidayRepo.findMany(effectiveTenantId, {
      where: { date: { gte: startDate, lte: endDate } },
    });
    const holidaySet = new Set<string>(
      holidays.map((h: { date: Date }) => h.date.toISOString().split("T")[0]),
    );

    const leaveWhere: Prisma.LeaveRequestWhereInput = {
      status: "APPROVED",
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(userIds !== undefined && { userId: { in: userIds } }),
    };

    const leaves = await prisma.leaveRequest.findMany({
      where: leaveWhere,
      select: { startDate: true, endDate: true, type: true },
    });

    const dailyMap = new Map<
      string,
      {
        present: number;
        late: number;
        absent: number;
        isHoliday: boolean;
        sakit: number;
        cuti: number;
        izin: number;
      }
    >();

    const ensureDate = (dateKey: string) => {
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          present: 0,
          late: 0,
          absent: 0,
          isHoliday: holidaySet.has(dateKey),
          sakit: 0,
          cuti: 0,
          izin: 0,
        });
      }
      return dailyMap.get(dateKey)!;
    };

    attendanceStats.forEach(
      (stat: { date: string; present: number; late: number }) => {
        const d = ensureDate(stat.date);
        d.present = stat.present;
        d.late = stat.late;
      },
    );

    holidaySet.forEach((date: string) => {
      if (date) ensureDate(date);
    });

    leaves.forEach(
      (leave: { startDate: Date; endDate: Date; type: string }) => {
        const current = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        while (current <= end) {
          if (current >= startDate && current <= endDate) {
            const dateKey = current.toISOString().split("T")[0] ?? "";
            if (dateKey) {
              const stats = ensureDate(dateKey);
              if (leave.type === "SAKIT") stats.sakit++;
              else if (leave.type === "CUTI") stats.cuti++;
              else if (leave.type === "IZIN") stats.izin++;
            }
          }
          current.setDate(current.getDate() + 1);
        }
      },
    );

    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        ...stats,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getGroupedStats(
    startDate: Date,
    endDate: Date,
    groupBy: "department" | "site",
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

    const userStats =
      await prisma.$queryRaw<
        { userId: string; present: number; late: number; total: number }[]
      >(query);

    if (userStats.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: userStats.map((s) => s.userId) } },
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
      const user = users.find((u) => u.id === stat.userId);
      if (!user) return;

      const groupId = groupBy === "site" ? user.siteId : user.departmentId;
      const groupName =
        groupBy === "site" ? user.sites?.name : user.departments?.name;

      if (!groupId) return;

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          id: groupId,
          name: groupName || "Unknown",
          present: 0,
          late: 0,
          total: 0,
        });
      }

      const g = groupMap.get(groupId)!;
      g.present += stat.present;
      g.late += stat.late;
      g.total += stat.total;
    });

    return Array.from(groupMap.values());
  }

  async getTopEmployees(
    startDate: Date,
    endDate: Date,
    limit: number = 5,
    siteId?: string,
    departmentId?: string,
  ) {
    let userIds: string[] | undefined = undefined;
    if (siteId || departmentId) {
      const users = await prisma.user.findMany({
        where: {
          ...(siteId && { siteId }),
          ...(departmentId && { departmentId }),
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
      if (userIds.length === 0) return [];
    }

    const where = buildActiveAttendanceWhere({
      checkIn: { gte: startDate, lte: endDate },
      status: { in: ["ON_TIME", "LATE"] },
      ...(userIds !== undefined && { userId: { in: userIds } }),
    });

    const groups = await prisma.attendance.groupBy({
      by: ["userId"],
      where,
      _count: { _all: true },
    });

    groups.sort((a, b) => b._count._all - a._count._all);
    const topIds = groups.slice(0, limit);

    if (topIds.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: topIds.map((g) => g.userId) } },
      select: {
        id: true,
        name: true,
        image: true,
        sites: { select: { name: true } },
        departments: { select: { name: true } },
      },
    });

    return topIds
      .map((g) => {
        const user = users.find((u) => u.id === g.userId);
        return {
          user,
          count: g._count._all,
        };
      })
      .filter((item) => item.user != null);
  }

  async getTopAbsentees(
    startDate: Date,
    endDate: Date,
    limit: number = 5,
    siteId?: string,
    departmentId?: string,
  ) {
    let userIds: string[] | undefined = undefined;
    const usersMatch = await prisma.user.findMany({
      where: {
        workingHourMode: { not: "FLEXIBLE" },
        ...(siteId && { siteId }),
        ...(departmentId && { departmentId }),
      },
      select: { id: true },
    });
    userIds = usersMatch.map((u) => u.id);
    if (userIds.length === 0) return [];

    const where = buildActiveAttendanceWhere({
      checkIn: { gte: startDate, lte: endDate },
      status: { in: ["ALPHA", "ABSENT"] },
      userId: { in: userIds },
    });

    const groups = await prisma.attendance.groupBy({
      by: ["userId"],
      where,
      _count: { _all: true },
    });

    groups.sort((a, b) => b._count._all - a._count._all);
    const topIds = groups.slice(0, limit);

    if (topIds.length === 0) return [];

    const users = await prisma.user.findMany({
      where: { id: { in: topIds.map((g) => g.userId) } },
      select: {
        id: true,
        name: true,
        image: true,
        sites: { select: { name: true } },
        departments: { select: { name: true } },
      },
    });

    return topIds
      .map((g) => {
        const user = users.find((u) => u.id === g.userId);
        return {
          user,
          count: g._count._all,
        };
      })
      .filter((item) => item.user != null);
  }

  async getUserAttendanceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    let userIds: string[] | undefined = undefined;
    if (siteId || departmentId) {
      const users = await prisma.user.findMany({
        where: {
          ...(siteId && { siteId }),
          ...(departmentId && { departmentId }),
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
      if (userIds.length === 0) return [];
    }

    const where = buildActiveAttendanceWhere({
      checkIn: { gte: startDate, lte: endDate },
      status: { in: ["ON_TIME", "LATE"] },
      ...(userIds !== undefined && { userId: { in: userIds } }),
      ...(tenantId ? { tenantId } : {}),
    });

    return prisma.attendance.groupBy({
      by: ["userId"],
      where,
      _count: { _all: true },
    });
  }

  async getUserAbsenceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const usersMatch = await prisma.user.findMany({
      where: {
        workingHourMode: { not: "FLEXIBLE" },
        ...(siteId && { siteId }),
        ...(departmentId && { departmentId }),
      },
      select: { id: true },
    });
    const userIds = usersMatch.map((u) => u.id);
    if (userIds.length === 0) return [];

    const where = buildActiveAttendanceWhere({
      checkIn: { gte: startDate, lte: endDate },
      status: { in: ["ALPHA", "ABSENT"] },
      userId: { in: userIds },
    });

    return prisma.attendance.groupBy({
      by: ["userId"],
      where,
      _count: { _all: true },
    });
  }

  async getUserAttendanceRecords(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    let userIds: string[] | undefined = undefined;
    if (siteId || departmentId) {
      const users = await prisma.user.findMany({
        where: {
          ...(siteId && { siteId }),
          ...(departmentId && { departmentId }),
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
      if (userIds.length === 0) return [];
    }

    const where = buildActiveAttendanceWhere({
      checkIn: { gte: startDate, lte: endDate },
      status: { in: ["ON_TIME", "LATE"] },
      ...(userIds !== undefined && { userId: { in: userIds } }),
    });

    return prisma.attendance.findMany({
      where,
      select: {
        userId: true,
        notes: true,
        status: true,
      },
    });
  }

  async getUserTotalDuration(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const { effectiveTenantId } = await resolveEffectiveTenantId();

    let userIds: string[] | undefined = undefined;
    if (siteId || departmentId) {
      const users = await prisma.user.findMany({
        where: {
          ...(siteId && { siteId }),
          ...(departmentId && { departmentId }),
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
      if (userIds.length === 0) return new Map<string, number>();
    }

    let query = Prisma.sql`
            SELECT
                a."userId",
                SUM(EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn")) / 60)::float as "totalMinutes"
            FROM "Attendance" a
            WHERE a."checkIn" >= ${startDate}
            AND a."checkIn" <= ${endDate}
            AND a."checkOut" IS NOT NULL
            AND a.status IN ('ON_TIME', 'LATE')
        `;

    if (effectiveTenantId) {
      query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`;
    }

    query = appendActiveAttendanceRawFilter(query);

    if (userIds !== undefined) {
      query = Prisma.sql`${query} AND a."userId" IN (${Prisma.join(userIds)})`;
    }

    query = Prisma.sql`${query} GROUP BY a."userId"`;

    const results =
      await prisma.$queryRaw<{ userId: string; totalMinutes: number }[]>(query);

    const userDurationMap = new Map<string, number>();
    results.forEach((r: { userId: string; totalMinutes: number }) => {
      userDurationMap.set(r.userId, r.totalMinutes || 0);
    });

    return userDurationMap;
  }

  async getUserLateStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    let userIds: string[] | undefined = undefined;
    if (siteId || departmentId) {
      const users = await prisma.user.findMany({
        where: {
          ...(siteId && { siteId }),
          ...(departmentId && { departmentId }),
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
      if (userIds.length === 0) return [];
    }

    const where = buildActiveAttendanceWhere({
      checkIn: { gte: startDate, lte: endDate },
      status: "LATE",
      ...(userIds !== undefined && { userId: { in: userIds } }),
    });

    return prisma.attendance.groupBy({
      by: ["userId"],
      where,
      _count: { _all: true },
    });
  }
}
