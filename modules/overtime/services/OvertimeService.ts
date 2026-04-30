import { logger } from "@/lib/logger";
import { OvertimeStatus } from "@prisma/client";

import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import {
  AttendanceQueryService,
  HolidayLookupService,
} from "@/modules/attendance";
import { UserLookupService } from "@/modules/users";

import {
  createNotification,
  WhatsAppApprovalButtonService,
} from "@/modules/notification";
import type {
  IOvertimeRepository,
  OvertimeQueryFilters,
} from "../domain/ports/IOvertimeRepository";
import type { OvertimeEntity } from "../domain/entities/OvertimeEntity";
import { OvertimeMapper } from "../mappers/OvertimeMapper";
import { OvertimeRepository } from "../repositories/OvertimeRepository";
import { OvertimeAutoCheckoutSchedulerService } from "./OvertimeAutoCheckoutSchedulerService";
import {
  assertApprovedRequest,
  assertInProgressRequest,
  assertPendingRequest,
  buildReportSummary,
  calculateCompletion,
  ensureStartTimeExists,
  type HolidayResolution,
  isUserOffDay,
  logFlexibleShiftShortfall,
  logMissingRegularAttendance,
  resolveHolidayDescription,
} from "./OvertimeService.helpers";

const OVERTIME_APPROVAL_LINK = "/admin/lembur";
const OVERTIME_APPROVAL_TITLE = "Pengajuan Lembur Baru";
const MAX_OVERTIME_DURATION_MS = 8 * 60 * 60 * 1000;
const MIN_DURATION_MINUTES = 1;

type CreateOvertimeRequestInput = {
  date: Date;
  reason: string;
  tenantId?: string;
};

type StartOvertimeInput = {
  photo: string;
  location?: string;
  timestamp?: Date;
  tenantId?: string;
};

type StopOvertimeInput = {
  photo: string;
  location?: string;
  timestamp?: Date;
};

export class OvertimeService {
  private repository: IOvertimeRepository;
  private holidayRepository: HolidayLookupService;
  private userRepository: UserLookupService;
  private attendanceRepository: AttendanceQueryService;
  private autoCheckoutScheduler: OvertimeAutoCheckoutSchedulerService;
  private whatsAppApprovalButtonService: WhatsAppApprovalButtonService;

  constructor(
    repository: IOvertimeRepository = new OvertimeRepository(),
    scheduler?: OvertimeAutoCheckoutSchedulerService,
  ) {
    this.repository = repository;
    this.holidayRepository = new HolidayLookupService();
    this.userRepository = new UserLookupService();
    this.attendanceRepository = new AttendanceQueryService();
    this.autoCheckoutScheduler =
      scheduler ?? new OvertimeAutoCheckoutSchedulerService(repository);
    this.whatsAppApprovalButtonService = new WhatsAppApprovalButtonService();
  }

  /** Create new overtime request for a day. */
  async createRequest(userId: string, data: CreateOvertimeRequestInput) {
    const dateRange = this.createDayRange(data.date);
    await this.ensureNoActiveRequest(userId, data.tenantId, dateRange);

    const request = await this.repository.create({
      userId,
      reason: data.reason,
      status: OvertimeStatus.PENDING,
      tenantId: data.tenantId,
    });

    await this.notifyAdminsForNewRequest(
      userId,
      data.reason,
      request,
      data.tenantId,
    );
    return request;
  }

  /** Start approved overtime session. */
  async startOvertime(
    userId: string,
    overtimeId: string,
    data: StartOvertimeInput,
  ) {
    const overtime = await this.requireOwnedOvertime(overtimeId, userId);
    assertApprovedRequest(overtime);

    const attendance = await this.findTodayAttendance(userId, data.tenantId);
    const holidayState = await this.resolveHolidayState(
      data.tenantId,
      attendance?.user?.workDays,
      attendance?.user?.workingHourMode,
    );

    logMissingRegularAttendance(
      userId,
      attendance,
      holidayState.isHolidayOvertime,
    );
    logFlexibleShiftShortfall(
      userId,
      attendance,
      holidayState.isHolidayOvertime,
    );

    const updatedOvertime = await this.repository.update(overtimeId, {
      status: OvertimeStatus.IN_PROGRESS,
      startTime: data.timestamp || new Date(),
      startPhoto: data.photo,
      startLocation: data.location,
      attendanceId: attendance?.id,
      ...holidayState,
    });

    ensureStartTimeExists(updatedOvertime);
    await this.scheduleAutoCheckout(updatedOvertime);
    return updatedOvertime;
  }

  /** Stop active overtime session. */
  async stopOvertime(
    userId: string,
    overtimeId: string,
    data: StopOvertimeInput,
  ) {
    const overtime = await this.requireOwnedOvertime(overtimeId, userId);
    assertInProgressRequest(overtime);

    const completion = calculateCompletion(overtime.startTime!, data.timestamp);
    const completedOvertime = await this.repository.update(overtimeId, {
      status: OvertimeStatus.COMPLETED,
      endTime: completion.endTime,
      endPhoto: data.photo,
      endLocation: data.location,
      duration: completion.duration,
    });

    await this.cancelAutoCheckout(overtimeId);
    return completedOvertime;
  }

  /** Get overtime history for one user. */
  async getHistory(userId: string, tenantId?: string) {
    return this.repository.findAll({ userId, tenantId });
  }

  /** Get overtime requests for admin listing. */
  async getAllRequests(filters?: OvertimeQueryFilters) {
    const [data, total, summary] = await Promise.all([
      this.repository.findAll(filters),
      this.repository.count(filters),
      this.repository.countByStatus(filters),
    ]);
    const enrichedData = await this.enrichOvertimeFlags(
      data,
      filters?.tenantId,
    );

    return {
      data: OvertimeMapper.toListItemDTOs(enrichedData),
      total,
      summary,
    };
  }

  /** Approve pending overtime request. */
  async approveRequest(id: string, approverId: string) {
    const existing = await this.requireOvertime(id);
    assertPendingRequest(existing, "approved");

    const result = await this.repository.update(id, {
      status: OvertimeStatus.APPROVED,
      approvedBy: approverId,
    });

    await this.notifyUserApproved(result);
    return result;
  }

  /** Reject pending overtime request. */
  async rejectRequest(id: string, reason: string) {
    const existing = await this.requireOvertime(id);
    assertPendingRequest(existing, "rejected");

    const result = await this.repository.update(id, {
      status: OvertimeStatus.REJECTED,
      rejectionReason: reason,
    });

    await this.notifyUserRejected(result, reason);
    return result;
  }

  /** Delete one overtime request. */
  async deleteOvertime(id: string) {
    return this.repository.delete(id);
  }

  /** Get one overtime by id for route orchestration. */
  async getOvertimeById(id: string, tenantId?: string) {
    return this.repository.findById(id, tenantId);
  }

  /** Update overtime fields from admin route. */
  async updateOvertime(
    id: string,
    data: { reason?: string; startTime?: Date; endTime?: Date },
  ) {
    return this.repository.update(id, data);
  }

  /** Get today attendance checkout state for mobile overtime. */
  async getTodayAttendanceState(userId: string, tenantId: string) {
    const attendance = await this.findTodayAttendance(userId, tenantId);
    return { hasCheckedOut: attendance?.checkOut !== null };
  }

  /** Get today holiday info for mobile overtime. */
  async getTodayHolidayInfo(tenantId: string) {
    const holiday = await this.holidayRepository.isHoliday(
      new Date(),
      tenantId,
    );
    if (!holiday.holiday) {
      return null;
    }

    return {
      description: holiday.holiday.description,
      isNational: holiday.holiday.isNational,
    };
  }

  /** Get aggregated overtime report data. */
  async getReportData(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const [stats, dailyStats, groupedBySite, groupedByDept, topEmployees] =
      await Promise.all([
        this.repository.getStatsByDateRange(
          startDate,
          endDate,
          siteId,
          departmentId,
        ),
        this.repository.getDailyStats(startDate, endDate, siteId, departmentId),
        this.repository.getGroupedStats(startDate, endDate, "site"),
        this.repository.getGroupedStats(startDate, endDate, "department"),
        this.repository.getTopEmployees(
          startDate,
          endDate,
          5,
          siteId,
          departmentId,
        ),
      ]);

    return {
      summary: buildReportSummary(stats.totalRequests, stats.totalDuration),
      trends: dailyStats,
      bySite: groupedBySite,
      byDepartment: groupedByDept,
      topEmployees,
    };
  }

  /** Create start and end timestamps for one day. */
  private createDayRange(date: Date) {
    return {
      startOfDay: toStartOfDay(new Date(date)),
      endOfDay: toEndOfDay(new Date(date)),
    };
  }

  /** Ensure user has no active request in the day. */
  private async ensureNoActiveRequest(
    userId: string,
    tenantId: string | undefined,
    dateRange: { startOfDay: Date; endOfDay: Date },
  ): Promise<void> {
    const existing = await this.repository.findActiveRequestByDate(
      userId,
      tenantId,
      dateRange.startOfDay,
      dateRange.endOfDay,
    );

    if (!existing) {
      return;
    }

    throw new Error(
      "Anda sudah memiliki pengajuan lembur aktif (Pending/Approved/Berjalan) untuk hari ini.",
    );
  }

  /** Send notification to admins when request is created. */
  private async notifyAdminsForNewRequest(
    userId: string,
    reason: string,
    request: OvertimeEntity,
    tenantId?: string,
  ): Promise<void> {
    try {
      const user = await this.userRepository.findByIdWithSite(userId, tenantId);
      const admins = await this.userRepository.findAdminsForNotification(
        tenantId,
        user?.siteId ?? null,
      );

      for (const admin of admins) {
        const message = `${user?.name || "Karyawan"} mengajukan lembur: ${reason}`;
        await createNotification({
          type: "SYSTEM",
          priority: "NORMAL",
          title: OVERTIME_APPROVAL_TITLE,
          message,
          link: OVERTIME_APPROVAL_LINK,
          userId: admin.id,
          sourceType: "OVERTIME",
          sourceId: request.id,
          tenantId,
        });
        await this.whatsAppApprovalButtonService.sendApprovalButton({
          phone: admin.phone,
          title: OVERTIME_APPROVAL_TITLE,
          message,
          approvalUrl: OVERTIME_APPROVAL_LINK,
        });
      }
    } catch (error) {
      logger.error("Failed to send notification:", error);
    }
  }

  /** Load overtime or throw when missing. */
  private async requireOvertime(id: string): Promise<OvertimeEntity> {
    const overtime = await this.repository.findById(id);
    if (overtime) {
      return overtime;
    }

    throw new Error("Overtime request not found");
  }

  /** Load user-owned overtime or throw when invalid. */
  private async requireOwnedOvertime(
    overtimeId: string,
    userId: string,
  ): Promise<OvertimeEntity> {
    const overtime = await this.repository.findById(overtimeId);
    if (!overtime) {
      throw new Error("Data lembur tidak ditemukan");
    }
    if (overtime.userId !== userId) {
      throw new Error("Akses ditolak");
    }

    return overtime;
  }

  /** Resolve holiday and off-day flags for today. */
  private async resolveHolidayState(
    tenantId?: string,
    workDays?: string | null,
    workingHourMode?: string | null,
  ): Promise<HolidayResolution> {
    const today = new Date();
    const holidayResult = await this.holidayRepository.isHoliday(
      today,
      tenantId,
    );
    const isOffDay = isUserOffDay(workDays, workingHourMode, today);

    return {
      isHolidayOvertime: holidayResult.isHoliday || isOffDay,
      isNationalHoliday:
        holidayResult.isHoliday && holidayResult.holiday?.isNational === true,
      isOffDay: isOffDay && !holidayResult.isHoliday,
      holidayDescription: resolveHolidayDescription(
        holidayResult.holiday?.description,
        isOffDay,
      ),
    };
  }

  /** Find today's attendance with user info. */
  private async findTodayAttendance(userId: string, tenantId?: string) {
    const dateRange = this.createDayRange(new Date());

    return this.attendanceRepository.findFirstWithUser({
      where: {
        userId,
        tenantId,
        checkIn: {
          gte: dateRange.startOfDay,
          lte: dateRange.endOfDay,
        },
      },
      orderBy: { checkIn: "desc" },
      userSelect: {
        workingHourMode: true,
        flexibleTargetHour: true,
        workDays: true,
      },
    });
  }

  /** Schedule overtime auto checkout with safe error handling. */
  private async scheduleAutoCheckout(overtime: OvertimeEntity): Promise<void> {
    try {
      await this.autoCheckoutScheduler.schedule({
        overtimeId: overtime.id,
        startTime: overtime.startTime!,
      });
    } catch (error) {
      this.logSchedulerError("schedule", overtime.id, error);
    }
  }

  /** Cancel overtime auto checkout with safe error handling. */
  private async cancelAutoCheckout(overtimeId: string): Promise<void> {
    try {
      await this.autoCheckoutScheduler.cancel(overtimeId);
    } catch (error) {
      this.logSchedulerError("cancel", overtimeId, error);
    }
  }

  /** Log scheduler errors consistently. */
  private logSchedulerError(
    action: "schedule" | "cancel",
    overtimeId: string,
    error: unknown,
  ): void {
    logger.error(
      `[Overtime] Failed to ${action} auto checkout for ${overtimeId}`,
      error,
    );
  }

  /** Calculate overtime completion values. */
  private calculateCompletion(startTime: Date, requestedEndTime?: Date) {
    const effectiveEndTime = requestedEndTime || new Date();
    const autoCheckoutTime = new Date(
      startTime.getTime() + MAX_OVERTIME_DURATION_MS,
    );
    const endTime =
      effectiveEndTime.getTime() > autoCheckoutTime.getTime()
        ? autoCheckoutTime
        : effectiveEndTime;
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));

    return {
      endTime,
      duration:
        durationMinutes > MIN_DURATION_MINUTES
          ? durationMinutes
          : MIN_DURATION_MINUTES,
    };
  }

  /** Enrich legacy overtime records with computed holiday flags. */
  private async enrichOvertimeFlags(
    data: OvertimeEntity[],
    tenantId?: string,
  ): Promise<OvertimeEntity[]> {
    return Promise.all(
      data.map(async (item) => {
        if (item.isHolidayOvertime) {
          return item;
        }

        const holiday = await this.holidayRepository.isHoliday(
          item.createdAt,
          tenantId,
        );
        const isOffDay = isUserOffDay(
          item.user?.workDays,
          item.user?.workingHourMode,
          item.createdAt,
        );

        return {
          ...item,
          isHolidayOvertime: holiday.isHoliday || isOffDay,
          isNationalHoliday:
            holiday.isHoliday && holiday.holiday?.isNational === true,
          isOffDay: isOffDay && !holiday.isHoliday,
          holidayDescription: resolveHolidayDescription(
            holiday.holiday?.description,
            isOffDay,
          ),
        };
      }),
    );
  }

  /** Notify employee that overtime was approved. */
  private async notifyUserApproved(result: OvertimeEntity): Promise<void> {
    try {
      await createNotification({
        type: "SYSTEM",
        priority: "HIGH",
        title: "Pengajuan Lembur Disetujui",
        message:
          "Pengajuan lembur Anda telah disetujui. Silakan mulai lembur setelah checkout.",
        link: "/karyawan/lembur",
        userId: result.userId,
        sourceType: "OVERTIME",
        sourceId: result.id,
        tenantId: result.tenantId || undefined,
      });
    } catch (error) {
      logger.error("Failed to send notification:", error);
    }
  }

  /** Notify employee that overtime was rejected. */
  private async notifyUserRejected(
    result: OvertimeEntity,
    reason: string,
  ): Promise<void> {
    try {
      await createNotification({
        type: "SYSTEM",
        priority: "HIGH",
        title: "Pengajuan Lembur Ditolak",
        message: `Alasan: ${reason}`,
        link: "/karyawan/lembur",
        userId: result.userId,
        sourceType: "OVERTIME",
        sourceId: result.id,
        tenantId: result.tenantId || undefined,
      });
    } catch (error) {
      logger.error("Failed to send notification:", error);
    }
  }
}
