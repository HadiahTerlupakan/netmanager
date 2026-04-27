import { Prisma, OvertimeStatus } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { getTenantIdFromContext } from "@/lib/tenant-context";

import type {
  CancelOvertimeAutoCheckoutScheduleInput,
  CompleteOvertimeAutoCheckoutScheduleInput,
  CompleteScheduledAutoCheckoutInput,
  IOvertimeRepository,
  OvertimeCreateInput,
  OvertimeQueryFilters,
  OvertimeStatusCountFilters,
  OvertimeUpdateInput,
  UpsertOvertimeAutoCheckoutScheduleInput,
} from "../domain/ports/IOvertimeRepository";
import { OvertimeMapper } from "../mappers/OvertimeMapper";

const DEFAULT_TOP_EMPLOYEES_LIMIT = 5;
const MISSING_TENANT_ID = "___MISSING_TENANT_ID___";
const ACTIVE_OVERTIME_STATUSES: OvertimeStatus[] = [
  OvertimeStatus.PENDING,
  OvertimeStatus.APPROVED,
  OvertimeStatus.IN_PROGRESS,
];
const PAID_OVERTIME_STATUSES: OvertimeStatus[] = [
  OvertimeStatus.APPROVED,
  OvertimeStatus.COMPLETED,
];

export class OvertimeRepository implements IOvertimeRepository {
  /** Find active overtime request in date range. */
  async findActiveRequestByDate(
    userId: string,
    tenantId: string | undefined,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    const record = await prisma.overtime.findFirst({
      where: {
        userId,
        tenantId,
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ACTIVE_OVERTIME_STATUSES },
      },
      include: this.getOvertimeInclude(),
    });

    return record ? OvertimeMapper.toDomain(record) : null;
  }

  /** Find overtime by id. */
  async findById(id: string, tenantId?: string) {
    const record = await prisma.overtime.findFirst({
      where: { id, tenantId },
      include: this.getOvertimeInclude(),
    });

    return record ? OvertimeMapper.toDomain(record) : null;
  }

  /** Find overtime records with filters. */
  async findAll(filters?: OvertimeQueryFilters) {
    const records = await prisma.overtime.findMany({
      where: this.buildOvertimeWhere(filters),
      orderBy: { createdAt: "desc" },
      include: this.getOvertimeInclude(),
      skip: filters?.skip,
      take: filters?.take,
    });

    return records.map((record) => OvertimeMapper.toDomain(record));
  }

  /** Count overtime records with filters. */
  async count(filters?: OvertimeQueryFilters): Promise<number> {
    return prisma.overtime.count({ where: this.buildOvertimeWhere(filters) });
  }

  /** Count overtime records grouped by status. */
  async countByStatus(filters?: OvertimeStatusCountFilters) {
    const groups = await prisma.overtime.groupBy({
      by: ["status"],
      where: this.buildStatusCountWhere(filters),
      _count: { _all: true },
    });

    return groups.reduce<Record<string, number>>((result, item) => {
      result[item.status] = item._count._all;
      return result;
    }, {});
  }

  /** Create overtime record. */
  async create(data: OvertimeCreateInput) {
    const record = await prisma.overtime.create({
      data: this.toCreateData(data),
      include: this.getOvertimeInclude(),
    });

    return OvertimeMapper.toDomain(record);
  }

  /** Update overtime record. */
  async update(id: string, data: OvertimeUpdateInput) {
    const record = await prisma.overtime.update({
      where: { id },
      data: this.toUpdateData(data),
      include: this.getOvertimeInclude(),
    });

    return OvertimeMapper.toDomain(record);
  }

  /** Delete overtime record. */
  async delete(id: string): Promise<void> {
    await prisma.overtime.delete({ where: { id } });
  }

  /** Get aggregate overtime stats in date range. */
  async getStatsByDateRange(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
    tenantId?: string,
  ) {
    const stats = await prisma.overtime.aggregate({
      _count: { _all: true },
      _sum: { duration: true },
      where: this.buildReportWhere({
        startDate,
        endDate,
        siteId,
        departmentId,
        tenantId,
      }),
    });

    return {
      totalRequests: stats._count._all,
      totalDuration: stats._sum.duration || 0,
    };
  }

  /** Get daily overtime stats. */
  async getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const tenantContext = await getTenantIdFromContext();
    const query = this.buildDailyStatsQuery({
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantContext,
    });
    const stats =
      await prisma.$queryRaw<
        { date: string; requests: number; duration: number }[]
      >(query);

    return stats
      .map((item) => ({
        date: item.date,
        requests: Number(item.requests),
        duration: Number(item.duration || 0),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  /** Get grouped overtime stats. */
  async getGroupedStats(
    startDate: Date,
    endDate: Date,
    groupBy: "department" | "site",
  ) {
    const tenantContext = await getTenantIdFromContext();
    const query = this.buildGroupedStatsQuery({
      startDate,
      endDate,
      groupBy,
      tenantContext,
    });
    const stats =
      await prisma.$queryRaw<
        { name: string; requests: number; duration: number }[]
      >(query);

    return stats.map((item) => ({
      name: item.name,
      requests: Number(item.requests),
      duration: Number(item.duration || 0),
    }));
  }

  /** Get employees with highest overtime duration. */
  async getTopEmployees(
    startDate: Date,
    endDate: Date,
    limit: number = DEFAULT_TOP_EMPLOYEES_LIMIT,
    siteId?: string,
    departmentId?: string,
  ) {
    const groups = await prisma.overtime.groupBy({
      by: ["userId"],
      where: this.buildPaidOvertimeWhere({
        startDate,
        endDate,
        siteId,
        departmentId,
      }),
      _sum: { duration: true },
    });
    const topGroups = groups.sort(this.sortByDurationDesc).slice(0, limit);
    const users = await this.findTopEmployeeUsers(topGroups);

    return topGroups
      .map((group) => this.mapTopEmployee(group, users))
      .filter((item): item is NonNullable<typeof item> => item != null);
  }

  /** Get grouped overtime duration by user. */
  async getUserOvertimeStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const groups = await prisma.overtime.groupBy({
      by: ["userId"],
      where: this.buildPaidOvertimeWhere({
        startDate,
        endDate,
        siteId,
        departmentId,
      }),
      _sum: { duration: true },
    });

    return groups.map((group) => ({
      userId: group.userId,
      totalDuration: group._sum.duration || 0,
    }));
  }

  /** Find auto checkout schedule by id. */
  async findAutoCheckoutScheduleById(id: string) {
    const record = await prisma.overtimeAutoCheckoutSchedule.findUnique({
      where: { id },
    });

    return record ? OvertimeMapper.toScheduleDomain(record) : null;
  }

  /** Find auto checkout schedule by overtime id. */
  async findAutoCheckoutScheduleByOvertimeId(overtimeId: string) {
    const record = await prisma.overtimeAutoCheckoutSchedule.findUnique({
      where: { overtimeId },
    });

    return record ? OvertimeMapper.toScheduleDomain(record) : null;
  }

  /** Find schedules for queue rehydration. */
  async findSchedulesForRehydration(_now: Date) {
    const records = await prisma.overtimeAutoCheckoutSchedule.findMany({
      where: { scheduleStatus: "SCHEDULED" },
      orderBy: { scheduledFor: "asc" },
    });

    return records.map((record) => OvertimeMapper.toScheduleDomain(record));
  }

  /** Attach queue job id to auto checkout schedule. */
  async attachAutoCheckoutJobId(overtimeId: string, jobId: string) {
    const record = await prisma.overtimeAutoCheckoutSchedule.update({
      where: { overtimeId },
      data: { jobId },
    });

    return OvertimeMapper.toScheduleDomain(record);
  }

  /** Create or replace auto checkout schedule. */
  async upsertAutoCheckoutSchedule(
    input: UpsertOvertimeAutoCheckoutScheduleInput,
  ) {
    const nextVersion = await this.getNextScheduleVersion(input.overtimeId);
    const record = await prisma.overtimeAutoCheckoutSchedule.upsert({
      where: { overtimeId: input.overtimeId },
      create: {
        overtimeId: input.overtimeId,
        scheduledFor: input.scheduledFor,
        jobId: input.jobId ?? null,
        version: nextVersion,
        scheduleStatus: "SCHEDULED",
      },
      update: {
        scheduledFor: input.scheduledFor,
        jobId: input.jobId ?? null,
        version: nextVersion,
        scheduleStatus: "SCHEDULED",
        cancelledAt: null,
        executedAt: null,
        lastError: null,
      },
    });

    return OvertimeMapper.toScheduleDomain(record);
  }

  /** Cancel scheduled auto checkout. */
  async cancelAutoCheckoutSchedule(
    input: CancelOvertimeAutoCheckoutScheduleInput,
  ) {
    return prisma.overtimeAutoCheckoutSchedule.updateMany({
      where: { overtimeId: input.overtimeId, scheduleStatus: "SCHEDULED" },
      data: {
        scheduleStatus: "CANCELLED",
        cancelledAt: input.cancelledAt,
        jobId: null,
      },
    });
  }

  /** Mark auto checkout schedule completed or failed. */
  async completeAutoCheckoutSchedule(
    input: CompleteOvertimeAutoCheckoutScheduleInput,
  ) {
    const record = await prisma.overtimeAutoCheckoutSchedule.update({
      where: { overtimeId: input.overtimeId },
      data: {
        scheduleStatus: input.scheduleStatus,
        executedAt: input.executedAt,
        lastError: input.lastError,
        jobId: null,
      },
    });

    return OvertimeMapper.toScheduleDomain(record);
  }

  /** Complete overtime and schedule atomically. */
  async completeScheduledAutoCheckout(
    input: CompleteScheduledAutoCheckoutInput,
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const scheduleResult =
          await transaction.overtimeAutoCheckoutSchedule.updateMany({
            where: {
              id: input.scheduleId,
              overtimeId: input.overtimeId,
              version: input.version,
              scheduleStatus: "SCHEDULED",
            },
            data: {
              scheduleStatus: "COMPLETED",
              executedAt: input.executedAt,
              lastError: null,
              jobId: null,
            },
          });

        if (scheduleResult.count !== 1) {
          return false;
        }

        const overtimeResult = await transaction.overtime.updateMany({
          where: { id: input.overtimeId, status: OvertimeStatus.IN_PROGRESS },
          data: {
            status: OvertimeStatus.COMPLETED,
            endTime: input.endTime,
            duration: input.duration,
            updatedAt: new Date(),
          },
        });

        if (overtimeResult.count !== 1) {
          throw new Error("OVERTIME_AUTO_CHECKOUT_CONFLICT");
        }

        return true;
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "OVERTIME_AUTO_CHECKOUT_CONFLICT"
      ) {
        return false;
      }

      throw error;
    }
  }

  /** Build shared overtime include. */
  private getOvertimeInclude() {
    return {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          workDays: true,
          workingHourMode: true,
          siteId: true,
          departmentId: true,
          sites: { select: { name: true } },
          departments: { select: { name: true } },
        },
      },
      attendance: true,
    } satisfies Prisma.OvertimeInclude;
  }

  /** Build overtime where clause. */
  private buildOvertimeWhere(filters?: OvertimeQueryFilters) {
    const where: Prisma.OvertimeWhereInput = { tenantId: filters?.tenantId };

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.status) where.status = filters.status as OvertimeStatus;
    if (filters?.startDate && filters?.endDate) {
      where.createdAt = { gte: filters.startDate, lte: filters.endDate };
    }
    if (filters?.siteId || filters?.departmentId) {
      where.user = this.buildUserScopeFilter(
        filters.siteId,
        filters.departmentId,
      );
    }
    if (filters?.holidayType) {
      this.applyHolidayFilter(where, filters.holidayType);
    }

    return where;
  }

  /** Build status count where clause. */
  private buildStatusCountWhere(filters?: OvertimeStatusCountFilters) {
    const where: Prisma.OvertimeWhereInput = { tenantId: filters?.tenantId };

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.startDate && filters?.endDate) {
      where.createdAt = { gte: filters.startDate, lte: filters.endDate };
    }
    if (filters?.siteId || filters?.departmentId) {
      where.user = this.buildUserScopeFilter(
        filters.siteId,
        filters.departmentId,
      );
    }

    return where;
  }

  /** Apply holiday filter to where clause. */
  private applyHolidayFilter(
    where: Prisma.OvertimeWhereInput,
    holidayType: string,
  ): void {
    if (holidayType === "REGULAR") where.isHolidayOvertime = false;
    if (holidayType === "NATIONAL") where.isNationalHoliday = true;
    if (holidayType === "OFFDAY") where.isOffDay = true;
    if (holidayType === "ALL_HOLIDAY") where.isHolidayOvertime = true;
    if (holidayType === "COLLECTIVE") {
      where.AND = [
        { isHolidayOvertime: true },
        { isNationalHoliday: false },
        { isOffDay: false },
      ];
    }
  }

  /** Build user scope filter. */
  private buildUserScopeFilter(siteId?: string, departmentId?: string) {
    return {
      ...(siteId && { siteId }),
      ...(departmentId && { departmentId }),
    };
  }

  /** Build create input for Prisma. */
  private toCreateData(data: OvertimeCreateInput): Prisma.OvertimeCreateInput {
    return {
      id: randomUUID(),
      reason: data.reason,
      status: data.status as OvertimeStatus,
      updatedAt: new Date(),
      user: { connect: { id: data.userId } },
      tenant: data.tenantId ? { connect: { id: data.tenantId } } : undefined,
    };
  }

  /** Build update input for Prisma. */
  private toUpdateData(data: OvertimeUpdateInput): Prisma.OvertimeUpdateInput {
    return {
      updatedAt: new Date(),
      ...(data.status && { status: data.status as OvertimeStatus }),
      ...(data.startTime && { startTime: data.startTime }),
      ...(data.startPhoto !== undefined && { startPhoto: data.startPhoto }),
      ...(data.startLocation !== undefined && {
        startLocation: data.startLocation,
      }),
      ...(data.endTime !== undefined && { endTime: data.endTime }),
      ...(data.endPhoto !== undefined && { endPhoto: data.endPhoto }),
      ...(data.endLocation !== undefined && { endLocation: data.endLocation }),
      ...(data.duration !== undefined && { duration: data.duration }),
      ...(data.approvedBy !== undefined && { approvedBy: data.approvedBy }),
      ...(data.rejectionReason !== undefined && {
        rejectionReason: data.rejectionReason,
      }),
      ...(data.attendanceId !== undefined && {
        attendance: data.attendanceId
          ? { connect: { id: data.attendanceId } }
          : { disconnect: true },
      }),
      ...(data.isHolidayOvertime !== undefined && {
        isHolidayOvertime: data.isHolidayOvertime,
      }),
      ...(data.isNationalHoliday !== undefined && {
        isNationalHoliday: data.isNationalHoliday,
      }),
      ...(data.isOffDay !== undefined && { isOffDay: data.isOffDay }),
      ...(data.holidayDescription !== undefined && {
        holidayDescription: data.holidayDescription,
      }),
      ...(data.reason !== undefined && { reason: data.reason }),
    };
  }

  /** Build report where clause. */
  private buildReportWhere(params: {
    startDate: Date;
    endDate: Date;
    siteId?: string;
    departmentId?: string;
    tenantId?: string;
  }) {
    const where: Prisma.OvertimeWhereInput = {
      createdAt: { gte: params.startDate, lte: params.endDate },
      tenantId: params.tenantId,
    };

    if (params.siteId || params.departmentId) {
      where.user = this.buildUserScopeFilter(
        params.siteId,
        params.departmentId,
      );
    }

    return where;
  }

  /** Build raw SQL for daily stats. */
  private buildDailyStatsQuery(params: {
    startDate: Date;
    endDate: Date;
    siteId?: string;
    departmentId?: string;
    tenantContext: Awaited<ReturnType<typeof getTenantIdFromContext>>;
  }) {
    const { tenantId, isSuperAdmin } = params.tenantContext;
    const effectiveTenantId =
      !isSuperAdmin && !tenantId ? MISSING_TENANT_ID : tenantId;
    let query = Prisma.sql`
      SELECT
        TO_CHAR(o."createdAt", 'YYYY-MM-DD') as date,
        COUNT(*)::int as requests,
        SUM(o.duration)::int as duration
      FROM "Overtime" o
    `;

    if (params.siteId || params.departmentId) {
      query = Prisma.sql`${query} JOIN "User" u ON o."userId" = u.id`;
    }

    query = Prisma.sql`${query}
      WHERE o."createdAt" >= ${params.startDate}
      AND o."createdAt" <= ${params.endDate}
    `;

    if (!isSuperAdmin) {
      query = Prisma.sql`${query} AND o."tenantId" = ${effectiveTenantId}`;
    }
    if (params.siteId) {
      query = Prisma.sql`${query} AND u."siteId" = ${params.siteId}`;
    }
    if (params.departmentId) {
      query = Prisma.sql`${query} AND u."departmentId" = ${params.departmentId}`;
    }

    return Prisma.sql`${query} GROUP BY TO_CHAR(o."createdAt", 'YYYY-MM-DD')`;
  }

  /** Build raw SQL for grouped stats. */
  private buildGroupedStatsQuery(params: {
    startDate: Date;
    endDate: Date;
    groupBy: "department" | "site";
    tenantContext: Awaited<ReturnType<typeof getTenantIdFromContext>>;
  }) {
    const { tenantId, isSuperAdmin } = params.tenantContext;
    const effectiveTenantId =
      !isSuperAdmin && !tenantId ? MISSING_TENANT_ID : tenantId;
    const isSiteGroup = params.groupBy === "site";
    const groupByColumn = isSiteGroup
      ? Prisma.sql`u."siteId"`
      : Prisma.sql`u."departmentId"`;
    const groupByNameColumn = isSiteGroup
      ? Prisma.sql`s.name`
      : Prisma.sql`d.name`;
    const joinTable = isSiteGroup
      ? Prisma.sql`JOIN "sites" s ON u."siteId" = s.id`
      : Prisma.sql`JOIN "departments" d ON u."departmentId" = d.id`;

    return Prisma.sql`
      SELECT
        ${groupByNameColumn} as name,
        COUNT(*)::int as requests,
        SUM(o.duration)::int as duration
      FROM "Overtime" o
      JOIN "User" u ON o."userId" = u.id
      ${joinTable}
      WHERE o."createdAt" >= ${params.startDate}
      AND o."createdAt" <= ${params.endDate}
      ${!isSuperAdmin ? Prisma.sql`AND o."tenantId" = ${effectiveTenantId}` : Prisma.empty}
      GROUP BY ${groupByColumn}, ${groupByNameColumn}
    `;
  }

  /** Build paid overtime where clause. */
  private buildPaidOvertimeWhere(params: {
    startDate: Date;
    endDate: Date;
    siteId?: string;
    departmentId?: string;
  }) {
    const where: Prisma.OvertimeWhereInput = {
      createdAt: { gte: params.startDate, lte: params.endDate },
      status: { in: PAID_OVERTIME_STATUSES },
    };

    if (params.siteId || params.departmentId) {
      where.user = this.buildUserScopeFilter(
        params.siteId,
        params.departmentId,
      );
    }

    return where;
  }

  /** Sort grouped durations descending. */
  private sortByDurationDesc(
    left: { _sum: { duration: number | null } },
    right: { _sum: { duration: number | null } },
  ) {
    return (right._sum.duration || 0) - (left._sum.duration || 0);
  }

  /** Load employee rows for top overtime report. */
  private async findTopEmployeeUsers(groups: { userId: string }[]) {
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

  /** Map top employee aggregate to domain entity. */
  private mapTopEmployee(
    group: { userId: string; _sum: { duration: number | null } },
    users: Array<{
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      siteId: string | null;
      departmentId: string | null;
      sites: { name: string } | null;
      departments: { name: string } | null;
    }>,
  ) {
    const user = users.find((item) => item.id === group.userId);
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

  /** Get next schedule version. */
  private async getNextScheduleVersion(overtimeId: string): Promise<number> {
    const current = await prisma.overtimeAutoCheckoutSchedule.findUnique({
      where: { overtimeId },
      select: { version: true },
    });

    return (current?.version ?? 0) + 1;
  }
}
