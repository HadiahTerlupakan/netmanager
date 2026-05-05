import { prisma } from "@/lib/prisma";

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
import {
  ACTIVE_OVERTIME_STATUSES,
  buildOvertimeWhere,
  buildStatusCountWhere,
  OVERTIME_INCLUDE,
  toCreateData,
  toUpdateData,
} from "./OvertimeRepository.helpers";
import { OvertimeReportRepository } from "./OvertimeReportRepository";
import { OvertimeScheduleRepository } from "./OvertimeScheduleRepository";

/** Menangani persistence inti overtime dan mendelegasikan report/schedule. */
export class OvertimeRepository implements IOvertimeRepository {
  private readonly reportRepository = new OvertimeReportRepository();

  private readonly scheduleRepository = new OvertimeScheduleRepository();

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
      include: OVERTIME_INCLUDE,
    });

    return record ? OvertimeMapper.toDomain(record) : null;
  }

  /** Find overtime by id. */
  async findById(id: string, tenantId?: string) {
    const record = await prisma.overtime.findFirst({
      where: { id, tenantId },
      include: OVERTIME_INCLUDE,
    });

    return record ? OvertimeMapper.toDomain(record) : null;
  }

  /** Find overtime records with filters. */
  async findAll(filters?: OvertimeQueryFilters) {
    const records = await prisma.overtime.findMany({
      where: buildOvertimeWhere(filters),
      orderBy: { createdAt: "desc" },
      include: OVERTIME_INCLUDE,
      skip: filters?.skip,
      take: filters?.take,
    });

    return records.map((record) => OvertimeMapper.toDomain(record));
  }

  /** Count overtime records with filters. */
  async count(filters?: OvertimeQueryFilters): Promise<number> {
    return prisma.overtime.count({ where: buildOvertimeWhere(filters) });
  }

  /** Count overtime records grouped by status. */
  async countByStatus(filters?: OvertimeStatusCountFilters) {
    const groups = await prisma.overtime.groupBy({
      by: ["status"],
      where: buildStatusCountWhere(filters),
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
      data: toCreateData(data),
      include: OVERTIME_INCLUDE,
    });

    return OvertimeMapper.toDomain(record);
  }

  /** Update overtime record. */
  async update(id: string, data: OvertimeUpdateInput) {
    const record = await prisma.overtime.update({
      where: { id },
      data: toUpdateData(data),
      include: OVERTIME_INCLUDE,
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
    return this.reportRepository.getStatsByDateRange({
      startDate,
      endDate,
      siteId,
      departmentId,
      tenantId,
    });
  }

  /** Get daily overtime stats. */
  async getDailyStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getDailyStats({
      startDate,
      endDate,
      siteId,
      departmentId,
    });
  }

  /** Get grouped overtime stats. */
  async getGroupedStats(
    startDate: Date,
    endDate: Date,
    groupBy: "department" | "site",
  ) {
    return this.reportRepository.getGroupedStats({
      startDate,
      endDate,
      groupBy,
    });
  }

  /** Get employees with highest overtime duration. */
  async getTopEmployees(
    startDate: Date,
    endDate: Date,
    limit?: number,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getTopEmployees({
      startDate,
      endDate,
      limit,
      siteId,
      departmentId,
    });
  }

  /** Get grouped overtime duration by user. */
  async getUserOvertimeStats(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportRepository.getUserOvertimeStats({
      startDate,
      endDate,
      siteId,
      departmentId,
    });
  }

  /** Find auto checkout schedule by id. */
  async findAutoCheckoutScheduleById(id: string) {
    return this.scheduleRepository.findById(id);
  }

  /** Find auto checkout schedule by overtime id. */
  async findAutoCheckoutScheduleByOvertimeId(overtimeId: string) {
    return this.scheduleRepository.findByOvertimeId(overtimeId);
  }

  /** Find schedules for queue rehydration. */
  async findSchedulesForRehydration(_now: Date) {
    return this.scheduleRepository.findForRehydration();
  }

  /** Attach queue job id to auto checkout schedule. */
  async attachAutoCheckoutJobId(overtimeId: string, jobId: string) {
    return this.scheduleRepository.attachJobId(overtimeId, jobId);
  }

  /** Create or replace auto checkout schedule. */
  async upsertAutoCheckoutSchedule(
    input: UpsertOvertimeAutoCheckoutScheduleInput,
  ) {
    return this.scheduleRepository.upsert(input);
  }

  /** Cancel scheduled auto checkout. */
  async cancelAutoCheckoutSchedule(
    input: CancelOvertimeAutoCheckoutScheduleInput,
  ) {
    return this.scheduleRepository.cancel(input);
  }

  /** Mark auto checkout schedule completed or failed. */
  async completeAutoCheckoutSchedule(
    input: CompleteOvertimeAutoCheckoutScheduleInput,
  ) {
    return this.scheduleRepository.complete(input);
  }

  /** Complete overtime and schedule atomically. */
  async completeScheduledAutoCheckout(
    input: CompleteScheduledAutoCheckoutInput,
  ): Promise<boolean> {
    return this.scheduleRepository.completeScheduledAutoCheckout(input);
  }
}
