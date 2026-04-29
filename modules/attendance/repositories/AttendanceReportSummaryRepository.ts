import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  appendActiveAttendanceRawFilter,
  buildActiveAttendanceWhere,
  createEmptyStatsResult,
  hasNoUserIds,
  mapUsersToIds,
  resolveEffectiveTenantId,
  toStatusCountMap,
} from "./attendance-repository-helpers";

export class AttendanceReportSummaryRepository {
  /** Ambil ringkasan status attendance berdasarkan rentang tanggal. */
  async getStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const userIds = await this.findScopedUserIds(siteId, departmentId);
    if (hasNoUserIds(userIds)) return createEmptyStatsResult();

    const where = buildActiveAttendanceWhere({
      checkIn: { gte: startDate, lte: endDate },
      ...(userIds !== undefined && { userId: { in: userIds } }),
    });
    const [statusCounts, total, avgDurationMinutes] = await Promise.all([
      prisma.attendance.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.attendance.count({ where }),
      this.getAverageDurationMinutes(startDate, endDate, userIds),
    ]);

    return {
      total,
      avgDurationMinutes,
      statusCounts: toStatusCountMap(statusCounts, (row) => row.status),
    };
  }

  /** Ambil ringkasan status evaluasi attendance berdasarkan rentang tanggal. */
  async getEvaluationStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const userIds = await this.findScopedUserIds(siteId, departmentId);
    if (hasNoUserIds(userIds)) return createEmptyStatsResult();

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

  private async findScopedUserIds(siteId?: string, departmentId?: string) {
    if (!siteId && !departmentId) return undefined;
    const users = await prisma.user.findMany({
      where: {
        ...(siteId && { siteId }),
        ...(departmentId && { departmentId }),
      },
      select: { id: true },
    });
    return mapUsersToIds(users);
  }

  private async getAverageDurationMinutes(
    startDate: Date,
    endDate: Date,
    userIds?: string[],
  ) {
    const { effectiveTenantId } = await resolveEffectiveTenantId();
    let query = Prisma.sql`
      SELECT AVG(EXTRACT(EPOCH FROM (a."checkOut" - a."checkIn")) / 60)::float as "avgDuration"
      FROM "Attendance" a
      WHERE a."checkIn" >= ${startDate}
      AND a."checkIn" <= ${endDate}
      AND a."checkOut" IS NOT NULL
    `;
    if (effectiveTenantId)
      query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`;
    query = appendActiveAttendanceRawFilter(query);
    if (userIds !== undefined)
      query = Prisma.sql`${query} AND a."userId" IN (${Prisma.join(userIds)})`;

    const avgResult = await prisma.$queryRaw<{ avgDuration: number }[]>(query);
    return avgResult[0]?.avgDuration ? Math.round(avgResult[0].avgDuration) : 0;
  }
}
