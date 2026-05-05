import { OvertimeStatus } from "../types/overtime.enums";

import type {
  IOvertimeRepository,
  OvertimeQueryFilters,
} from "../domain/ports/IOvertimeRepository";
import { OvertimeRepository } from "../repositories/OvertimeRepository";
import { OvertimeAttendanceStateService } from "./OvertimeAttendanceStateService";
import { OvertimeAutoCheckoutSchedulerService } from "./OvertimeAutoCheckoutSchedulerService";
import { OvertimeNotificationService } from "./OvertimeNotificationService";
import { OvertimeQueryReportService } from "./OvertimeQueryReportService";
import { OvertimeServiceAccess } from "./OvertimeService.access";
import {
  assertApprovedRequest,
  assertInProgressRequest,
  assertPendingRequest,
  calculateCompletion,
  ensureStartTimeExists,
  logFlexibleShiftShortfall,
  logMissingRegularAttendance,
} from "./OvertimeService.helpers";
import { OvertimeServiceScheduler } from "./OvertimeService.scheduler";

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

/** Mengelola mutation inti overtime user dan admin. */
export class OvertimeService {
  private readonly accessService: OvertimeServiceAccess;

  private readonly schedulerService: OvertimeServiceScheduler;

  constructor(
    private readonly repository: IOvertimeRepository = new OvertimeRepository(),
    scheduler?: OvertimeAutoCheckoutSchedulerService,
    private readonly notificationService: OvertimeNotificationService = new OvertimeNotificationService(),
    private readonly attendanceStateService: OvertimeAttendanceStateService = new OvertimeAttendanceStateService(),
    private readonly queryReportService: OvertimeQueryReportService = new OvertimeQueryReportService(
      repository,
      attendanceStateService,
    ),
  ) {
    const autoCheckoutScheduler =
      scheduler ?? new OvertimeAutoCheckoutSchedulerService(repository);

    this.accessService = new OvertimeServiceAccess(repository);
    this.schedulerService = new OvertimeServiceScheduler(autoCheckoutScheduler);
  }

  /** Create new overtime request for a day. */
  async createRequest(userId: string, data: CreateOvertimeRequestInput) {
    await this.accessService.ensureNoActiveRequest(
      userId,
      data.tenantId,
      data.date,
    );

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
    const overtime = await this.accessService.requireOwnedOvertime(
      overtimeId,
      userId,
    );
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
    await this.schedulerService.schedule(updatedOvertime);

    return updatedOvertime;
  }

  /** Stop active overtime session. */
  async stopOvertime(
    userId: string,
    overtimeId: string,
    data: StopOvertimeInput,
  ) {
    const overtime = await this.accessService.requireOwnedOvertime(
      overtimeId,
      userId,
    );
    assertInProgressRequest(overtime);

    const completion = calculateCompletion(overtime.startTime!, data.timestamp);
    const completedOvertime = await this.repository.update(overtimeId, {
      status: OvertimeStatus.COMPLETED,
      endTime: completion.endTime,
      endPhoto: data.photo,
      endLocation: data.location,
      duration: completion.duration,
    });

    await this.schedulerService.cancel(overtimeId);

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
    const existing = await this.accessService.requireOvertime(id);
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
    const existing = await this.accessService.requireOvertime(id);
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
}
