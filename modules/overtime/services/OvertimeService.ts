import { logger } from "@/lib/logger";
import { OvertimeStatus } from "../types/overtime.enums";

import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import type {
  IOvertimeRepository,
  OvertimeQueryFilters,
} from "../domain/ports/IOvertimeRepository";
import type { OvertimeEntity } from "../domain/entities/OvertimeEntity";
import { OvertimeRepository } from "../repositories/OvertimeRepository";
import { OvertimeAttendanceStateService } from "./OvertimeAttendanceStateService";
import { OvertimeAutoCheckoutSchedulerService } from "./OvertimeAutoCheckoutSchedulerService";
import { OvertimeNotificationService } from "./OvertimeNotificationService";
import { OvertimeQueryReportService } from "./OvertimeQueryReportService";
import {
  assertApprovedRequest,
  assertInProgressRequest,
  assertPendingRequest,
  calculateCompletion,
  ensureStartTimeExists,
  logFlexibleShiftShortfall,
  logMissingRegularAttendance,
} from "./OvertimeService.helpers";

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
  private attendanceStateService: OvertimeAttendanceStateService;
  private autoCheckoutScheduler: OvertimeAutoCheckoutSchedulerService;
  private notificationService: OvertimeNotificationService;
  private queryReportService: OvertimeQueryReportService;

  constructor(
    repository: IOvertimeRepository = new OvertimeRepository(),
    scheduler?: OvertimeAutoCheckoutSchedulerService,
    notificationService: OvertimeNotificationService = new OvertimeNotificationService(),
    attendanceStateService: OvertimeAttendanceStateService = new OvertimeAttendanceStateService(),
    queryReportService: OvertimeQueryReportService = new OvertimeQueryReportService(
      repository,
      attendanceStateService,
    ),
  ) {
    this.repository = repository;
    this.attendanceStateService = attendanceStateService;
    this.autoCheckoutScheduler =
      scheduler ?? new OvertimeAutoCheckoutSchedulerService(repository);
    this.notificationService = notificationService;
    this.queryReportService = queryReportService;
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

    await this.notificationService.notifyAdminsForNewRequest({
      userId,
      reason: data.reason,
      request,
      tenantId: data.tenantId,
    });
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

    const attendance = await this.attendanceStateService.findTodayAttendance(
      userId,
      data.tenantId,
    );
    const holidayState = await this.attendanceStateService.resolveHolidayState({
      tenantId: data.tenantId,
      workDays: attendance?.user?.workDays,
      workingHourMode: attendance?.user?.workingHourMode,
    });

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
    return this.queryReportService.getHistory(userId, tenantId);
  }

  /** Get overtime requests for admin listing. */
  async getAllRequests(filters?: OvertimeQueryFilters) {
    return this.queryReportService.getAllRequests(filters);
  }

  /** Approve pending overtime request. */
  async approveRequest(id: string, approverId: string) {
    const existing = await this.requireOvertime(id);
    assertPendingRequest(existing, "approved");

    const result = await this.repository.update(id, {
      status: OvertimeStatus.APPROVED,
      approvedBy: approverId,
    });

    await this.notificationService.notifyUserApproved(result);
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

    await this.notificationService.notifyUserRejected(result, reason);
    return result;
  }

  /** Delete one overtime request. */
  async deleteOvertime(id: string) {
    return this.repository.delete(id);
  }

  /** Get one overtime by id for route orchestration. */
  async getOvertimeById(id: string, tenantId?: string) {
    return this.queryReportService.getOvertimeById(id, tenantId);
  }

  /** Update overtime fields from admin route. */
  async updateOvertime(
    id: string,
    data: { reason?: string; startTime?: Date; endTime?: Date },
  ) {
    return this.queryReportService.updateOvertime(id, data);
  }

  /** Get today attendance checkout state for mobile overtime. */
  async getTodayAttendanceState(userId: string, tenantId: string) {
    return this.attendanceStateService.getTodayAttendanceState(
      userId,
      tenantId,
    );
  }

  /** Get today holiday info for mobile overtime. */
  async getTodayHolidayInfo(tenantId: string) {
    return this.attendanceStateService.getTodayHolidayInfo(tenantId);
  }

  /** Get aggregated overtime report data. */
  async getReportData(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.queryReportService.getReportData({
      startDate,
      endDate,
      siteId,
      departmentId,
    });
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
}
