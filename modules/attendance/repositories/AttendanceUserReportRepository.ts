import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  appendActiveAttendanceRawFilter,
  buildActiveAttendanceWhere,
  resolveEffectiveTenantId,
} from "./attendance-repository-helpers";

export class AttendanceUserReportRepository {
  /** Ambil jumlah attendance hadir per user. */
  async getUserAttendanceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    const userIds = await this.findScopedUserIds(siteId, departmentId, false);
    if (userIds?.length === 0) return [];

    return prisma.attendance.groupBy({
      by: ["userId"],
      where: buildActiveAttendanceWhere({
        checkIn: { gte: startDate, lte: endDate },
        status: { in: ["ON_TIME", "LATE"] },
        ...(userIds !== undefined && { userId: { in: userIds } }),
        ...(tenantId ? { tenantId } : {}),
      }),
      _count: { _all: true },
    });
  }

  /** Ambil jumlah absence per user fixed-hour. */
  async getUserAbsenceStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const userIds = await this.findScopedUserIds(siteId, departmentId, true);
    if (userIds?.length === 0) return [];

    return prisma.attendance.groupBy({
      by: ["userId"],
      where: buildActiveAttendanceWhere({
        checkIn: { gte: startDate, lte: endDate },
        status: { in: ["ALPHA", "ABSENT"] },
        userId: { in: userIds },
      }),
      _count: { _all: true },
    });
  }

  /** Ambil record attendance hadir per user. */
  async getUserAttendanceRecords(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const userIds = await this.findScopedUserIds(siteId, departmentId, false);
    if (userIds?.length === 0) return [];

    return prisma.attendance.findMany({
      where: buildActiveAttendanceWhere({
        checkIn: { gte: startDate, lte: endDate },
        status: { in: ["ON_TIME", "LATE"] },
        ...(userIds !== undefined && { userId: { in: userIds } }),
      }),
      select: { userId: true, notes: true, status: true },
    });
  }

  /** Ambil total durasi kerja per user. */
  async getUserTotalDuration(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const { effectiveTenantId } = await resolveEffectiveTenantId();
    const userIds = await this.findScopedUserIds(siteId, departmentId, false);
    if (userIds?.length === 0) return new Map<string, number>();

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
    if (effectiveTenantId)
      query = Prisma.sql`${query} AND a."tenantId" = ${effectiveTenantId}`;
    query = appendActiveAttendanceRawFilter(query);
    if (userIds !== undefined)
      query = Prisma.sql`${query} AND a."userId" IN (${Prisma.join(userIds)})`;
    query = Prisma.sql`${query} GROUP BY a."userId"`;

    const results =
      await prisma.$queryRaw<{ userId: string; totalMinutes: number }[]>(query);
    return new Map(results.map((row) => [row.userId, row.totalMinutes || 0]));
  }

  /** Ambil jumlah keterlambatan per user. */
  async getUserLateStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const userIds = await this.findScopedUserIds(siteId, departmentId, false);
    if (userIds?.length === 0) return [];

    return prisma.attendance.groupBy({
      by: ["userId"],
      where: buildActiveAttendanceWhere({
        checkIn: { gte: startDate, lte: endDate },
        status: "LATE",
        ...(userIds !== undefined && { userId: { in: userIds } }),
      }),
      _count: { _all: true },
    });
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
}
