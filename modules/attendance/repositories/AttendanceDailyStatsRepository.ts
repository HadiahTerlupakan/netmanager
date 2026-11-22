import type { ReportSiteFilter } from "../domain/report-site-filter";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getTimezone } from "@/lib/utils/get-timezone";
import { PRESENT_ATTENDANCE_STATUSES } from "../domain/attendance-report-statuses";
import {
  getDateKeyInTimezone,
  listDateKeysInRange,
} from "../domain/report-date-keys";
import { HolidayRepository } from "./HolidayRepository";
import {
  appendActiveAttendanceRawFilter,
  resolveEffectiveTenantId,
} from "./attendance-repository-helpers";

type DailyStats = {
  present: number;
  late: number;
  absent: number;
  isHoliday: boolean;
  sakit: number;
  cuti: number;
  izin: number;
};

export class AttendanceDailyStatsRepository {
  /** Ambil statistik attendance harian dengan holiday dan leave. */
  async getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: ReportSiteFilter,
    departmentId?: string,
    tenantId?: string,
  ) {
    const { effectiveTenantId } = await resolveEffectiveTenantId(tenantId);
    const userIds = await this.findScopedUserIds(siteId, departmentId);
    if (userIds?.length === 0) return [];

    const timezone = await getTimezone(effectiveTenantId);
    const [attendanceStats, holidaySet, leaves] = await Promise.all([
      this.getAttendanceStats(
        startDate,
        endDate,
        effectiveTenantId,
        userIds,
        timezone,
      ),
      this.getHolidaySet(startDate, endDate, timezone, effectiveTenantId),
      this.getLeaves(startDate, endDate, userIds),
    ]);
    const dailyMap = this.buildDailyMap(attendanceStats, holidaySet);
    this.applyLeaves(dailyMap, leaves, { startDate, endDate, timezone });

    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));
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
    return users.map((user) => user.id);
  }

  private async getAttendanceStats(
    startDate: Date,
    endDate: Date,
    tenantId: string | undefined,
    userIds: string[] | undefined,
    timezone: string,
  ) {
    // Tanggal lokal tenant: kolom disimpan UTC tanpa zona, `TO_CHAR` langsung
    // memberi tanggal UTC sehingga absen sebelum jam 07.00 WIB jatuh ke hari sebelumnya.
    const dateKey = Prisma.sql`TO_CHAR((a."checkIn" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD')`;
    let query = Prisma.sql`
      SELECT
        ${dateKey} as date,
        COUNT(CASE WHEN a.status::text IN (${Prisma.join([...PRESENT_ATTENDANCE_STATUSES])}) THEN 1 END)::int as present,
        COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late
      FROM "Attendance" a
      WHERE a."checkIn" >= ${startDate}
      AND a."checkIn" <= ${endDate}
    `;
    if (tenantId) query = Prisma.sql`${query} AND a."tenantId" = ${tenantId}`;
    query = appendActiveAttendanceRawFilter(query);
    if (userIds !== undefined)
      query = Prisma.sql`${query} AND a."userId" IN (${Prisma.join(userIds)})`;
    // GROUP BY 1: ekspresi tanggal memakai parameter zona waktu; mengulangnya
    // di GROUP BY menjadi parameter lain yang ditolak PostgreSQL (42803).
    query = Prisma.sql`${query} GROUP BY 1`;
    return prisma.$queryRaw<{ date: string; present: number; late: number }[]>(
      query,
    );
  }

  private async getHolidaySet(
    startDate: Date,
    endDate: Date,
    timezone: string,
    tenantId?: string,
  ) {
    const holidayRepo = new HolidayRepository();
    const holidays = await holidayRepo.findMany(tenantId, {
      where: { date: { gte: startDate, lte: endDate } },
    });
    return new Set(
      holidays.map((holiday: { date: Date }) =>
        getDateKeyInTimezone(holiday.date, timezone),
      ),
    );
  }

  private async getLeaves(startDate: Date, endDate: Date, userIds?: string[]) {
    return prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        ...(userIds !== undefined && { userId: { in: userIds } }),
      },
      select: { startDate: true, endDate: true, type: true },
    });
  }

  private buildDailyMap(
    attendanceStats: { date: string; present: number; late: number }[],
    holidaySet: Set<string | undefined>,
  ) {
    const dailyMap = new Map<string, DailyStats>();
    const ensureDate = (dateKey: string) =>
      this.ensureDate(dailyMap, holidaySet, dateKey);

    attendanceStats.forEach((stat) => {
      const dateStats = ensureDate(stat.date);
      dateStats.present = stat.present;
      dateStats.late = stat.late;
    });
    holidaySet.forEach((date) => {
      if (date) ensureDate(date);
    });
    return dailyMap;
  }

  private ensureDate(
    dailyMap: Map<string, DailyStats>,
    holidaySet: Set<string | undefined>,
    dateKey: string,
  ) {
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
  }

  private applyLeaves(
    dailyMap: Map<string, DailyStats>,
    leaves: { startDate: Date; endDate: Date; type: string }[],
    range: { startDate: Date; endDate: Date; timezone: string },
  ) {
    const rangeStartKey = getDateKeyInTimezone(range.startDate, range.timezone);
    const rangeEndKey = getDateKeyInTimezone(range.endDate, range.timezone);
    leaves.forEach((leave) => {
      const dateKeys = listDateKeysInRange(
        getDateKeyInTimezone(leave.startDate, range.timezone),
        getDateKeyInTimezone(leave.endDate, range.timezone),
        rangeStartKey,
        rangeEndKey,
      );
      dateKeys.forEach((dateKey) =>
        this.applyLeaveDay(dailyMap, leave.type, dateKey),
      );
    });
  }

  private applyLeaveDay(
    dailyMap: Map<string, DailyStats>,
    type: string,
    dateKey: string,
  ) {
    const stats = this.ensureDate(dailyMap, new Set(), dateKey);
    if (type === "SAKIT") stats.sakit++;
    if (type === "CUTI") stats.cuti++;
    if (type === "IZIN") stats.izin++;
  }
}
