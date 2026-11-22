import type { ReportSiteFilter } from "../domain/report-site-filter";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PRESENT_ATTENDANCE_STATUSES } from "../domain/attendance-report-statuses";
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
    siteId?: ReportSiteFilter,
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

  private async findScopedUserIds(
    siteId?: ReportSiteFilter,
    departmentId?: string,
  ) {
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
      AND a.status::text IN (${Prisma.join([...PRESENT_ATTENDANCE_STATUSES])})
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
