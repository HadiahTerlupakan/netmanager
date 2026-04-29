import { logger } from "@/lib/logger";
import { OvertimeStatus } from "@prisma/client";

import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import {
  AttendanceQueryService,
  HolidayLookupService,
} from "@/modules/attendance";
import { UserLookupService } from "@/modules/users";

import { createNotification } from "../../notification/services/NotificationService";
import type {
  IOvertimeRepository,
  OvertimeQueryFilters,
} from "../domain/ports/IOvertimeRepository";
import type { OvertimeEntity } from "../domain/entities/OvertimeEntity";
import { OvertimeMapper } from "../mappers/OvertimeMapper";
import { OvertimeRepository } from "../repositories/OvertimeRepository";
import { OvertimeAutoCheckoutSchedulerService } from "./OvertimeAutoCheckoutSchedulerService";

const DEFAULT_TARGET_HOURS = 8;
const MAX_OVERTIME_DURATION_MS = 8 * 60 * 60 * 1000;
const MIN_DURATION_MINUTES = 0;
const DAY_MAP: Record<number, string> = {
  0: "SUN",
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
};

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

type HolidayResolution = {
  isHolidayOvertime: boolean;
  isNationalHoliday: boolean;
  isOffDay: boolean;
  holidayDescription: string | null;
};

export class OvertimeService {
  private repository: IOvertimeRepository;
  private holidayRepository: HolidayLookupService;
  private userRepository: UserLookupService;
  private attendanceRepository: AttendanceQueryService;
  private autoCheckoutScheduler: OvertimeAutoCheckoutSchedulerService;

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
    this.assertApprovedRequest(overtime);

    const attendance = await this.findTodayAttendance(userId, data.tenantId);
    const holidayState = await this.resolveHolidayState(
      data.tenantId,
      attendance?.user?.workDays,
      attendance?.user?.workingHourMode,
    );

    this.logMissingRegularAttendance(
      userId,
      attendance,
      holidayState.isHolidayOvertime,
    );
    this.logFlexibleShiftShortfall(
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

    await this.ensureStartTimeExists(updatedOvertime);
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
    this.assertInProgressRequest(overtime);

    const completion = this.calculateCompletion(
      overtime.startTime!,
      data.timestamp,
    );
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
    this.assertPendingRequest(existing, "approved");

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
    this.assertPendingRequest(existing, "rejected");

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
      summary: this.buildReportSummary(
        stats.totalRequests,
        stats.totalDuration,
      ),
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
        await createNotification({
          type: "SYSTEM",
          priority: "NORMAL",
          title: "Pengajuan Lembur Baru",
          message: `${user?.name || "Karyawan"} mengajukan lembur: ${reason}`,
          link: "/admin/lembur",
          userId: admin.id,
          sourceType: "OVERTIME",
          sourceId: request.id,
          tenantId,
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

  /** Ensure overtime is pending. */
  private assertPendingRequest(
    overtime: OvertimeEntity,
    nextAction: "approved" | "rejected",
  ): void {
    if (overtime.status === OvertimeStatus.PENDING) {
      return;
    }

    throw new Error(`Only pending overtime requests can be ${nextAction}`);
  }

  /** Ensure overtime is approved. */
  private assertApprovedRequest(overtime: OvertimeEntity): void {
    if (overtime.status === OvertimeStatus.APPROVED) {
      return;
    }

    throw new Error(
      "Pengajuan lembur belum disetujui atau status tidak valid.",
    );
  }

  /** Ensure overtime is in progress. */
  private assertInProgressRequest(overtime: OvertimeEntity): void {
    if (overtime.status !== OvertimeStatus.IN_PROGRESS) {
      throw new Error("Lembur belum dimulai.");
    }
    if (overtime.startTime) {
      return;
    }

    throw new Error("Data Start Time corrupt.");
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
    const isOffDay = this.isUserOffDay(workDays, workingHourMode, today);

    return {
      isHolidayOvertime: holidayResult.isHoliday || isOffDay,
      isNationalHoliday:
        holidayResult.isHoliday && holidayResult.holiday?.isNational === true,
      isOffDay: isOffDay && !holidayResult.isHoliday,
      holidayDescription: this.resolveHolidayDescription(
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

  /** Check whether date is off-day for user. */
  private isUserOffDay(
    workDays: string | null | undefined,
    mode: string | null | undefined,
    date: Date,
  ): boolean {
    if (!workDays || mode === "FLEXIBLE") {
      return false;
    }

    const dayName = DAY_MAP[date.getDay()];
    const workDayList = workDays
      .toUpperCase()
      .split(",")
      .map((item) => item.trim());
    return !workDayList.includes(dayName);
  }

  /** Log warning when no normal attendance exists. */
  private logMissingRegularAttendance(
    userId: string,
    attendance: Awaited<
      ReturnType<AttendanceQueryService["findFirstWithUser"]>
    >,
    isHolidayOvertime: boolean,
  ): void {
    if (isHolidayOvertime || attendance) {
      return;
    }

    logger.warn(
      `[Overtime] User ${userId} starting overtime without regular attendance`,
    );
  }

  /** Log warning when flexible shift is under target. */
  private logFlexibleShiftShortfall(
    userId: string,
    attendance: Awaited<
      ReturnType<AttendanceQueryService["findFirstWithUser"]>
    >,
    isHolidayOvertime: boolean,
  ): void {
    if (!attendance || attendance.user.workingHourMode !== "FLEXIBLE") {
      return;
    }
    if (isHolidayOvertime || !attendance.checkOut) {
      return;
    }

    const durationHours = this.calculateWorkedHours(
      attendance.checkIn,
      attendance.checkOut,
    );
    const targetHours =
      attendance.user.flexibleTargetHour || DEFAULT_TARGET_HOURS;
    if (durationHours >= targetHours) {
      return;
    }

    const shortfall = (targetHours - durationHours).toFixed(1);
    logger.warn(
      `[Overtime] User ${userId} starting overtime with incomplete regular shift: ${durationHours.toFixed(1)}h worked vs ${targetHours}h target (shortfall: ${shortfall}h)`,
    );
  }

  /** Convert attendance span to worked hours. */
  private calculateWorkedHours(checkIn: Date, checkOut: Date): number {
    const workedMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    return workedMs / (1000 * 60 * 60);
  }

  /** Resolve holiday description text. */
  private resolveHolidayDescription(
    holidayDescription?: string | null,
    isOffDay?: boolean,
  ): string | null {
    if (holidayDescription) {
      return holidayDescription;
    }
    if (isOffDay) {
      return "Hari Libur Karyawan";
    }

    return null;
  }

  /** Ensure updated overtime contains start time. */
  private async ensureStartTimeExists(overtime: OvertimeEntity): Promise<void> {
    if (overtime.startTime) {
      return;
    }

    throw new Error("Data Start Time corrupt.");
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
        const isOffDay = this.isUserOffDay(
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
          holidayDescription: this.resolveHolidayDescription(
            holiday.holiday?.description,
            isOffDay,
          ),
        };
      }),
    );
  }

  /** Build report summary object. */
  private buildReportSummary(totalRequests: number, totalDuration: number) {
    return {
      totalRequests,
      totalDuration,
      avgDuration:
        totalRequests > 0 ? Math.round(totalDuration / totalRequests) : 0,
    };
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
