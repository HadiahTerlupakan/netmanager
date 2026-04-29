import { AttendanceStatus, type WorkingHourMode } from "@prisma/client";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { OvertimeQueryService } from "@/modules/overtime";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import {
  AttendanceDailyEvaluator,
  type AttendanceEvaluationInput,
} from "./AttendanceDailyEvaluator";
import { AttendanceEvaluationAuditService } from "./AttendanceEvaluationAuditService";
import { type CachedUserAttendanceSettings } from "./attendance-service-helpers";
import { mapPersistedAttendanceEvaluation } from "./attendance-current-status-helpers";
import type { AttendanceEvaluationResult } from "../types/AttendanceEvaluation";

type RecomputeAttendanceInput = {
  attendance: {
    tenantId: string;
    userId: string;
    checkIn: Date;
    checkOut: Date | null;
    status: AttendanceStatus;
    geofenceStatus?: string | null;
    geofenceSiteName?: string | null;
  };
  timezone: string;
  workingHourMode:
    | CachedUserAttendanceSettings["workingHourMode"]
    | null
    | undefined;
  actorId: string;
  audit: { reason: string; actorType: string };
};

export class AttendanceEvaluationRecomputeService {
  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly attendanceEvaluator: AttendanceDailyEvaluator,
    private readonly evaluationAuditService: AttendanceEvaluationAuditService,
    private readonly leaveRepo: LeaveRepository,
    private readonly holidayRepo: HolidayRepository,
    private readonly overtimeRepo: OvertimeQueryService,
  ) {}

  /** Rekalkulasi evaluasi attendance dan catat audit perubahan. */
  async recomputeAttendanceEvaluation(
    input: RecomputeAttendanceInput,
  ): Promise<AttendanceEvaluationResult> {
    const { attendance, timezone, workingHourMode, actorId, audit } = input;
    const { workDate } = this.getEvaluationWindow(
      attendance.checkOut ?? attendance.checkIn,
      timezone,
    );
    const [evaluationInput, previousEvaluationRow] = await Promise.all([
      this.buildAttendanceEvaluationInput({
        attendance,
        timezone,
        workingHourMode,
      }),
      this.attendanceRepo.findLatestEvaluationForUser({
        userId: attendance.userId,
        tenantId: attendance.tenantId,
        workDate,
      }),
    ]);
    const nextEvaluation =
      await this.attendanceEvaluator.evaluate(evaluationInput);
    await this.evaluationAuditService.recordEvaluationChange({
      previous: mapPersistedAttendanceEvaluation(previousEvaluationRow),
      next: nextEvaluation,
      reason: audit.reason,
      actorType: audit.actorType,
      actorId,
    });
    return nextEvaluation;
  }

  private getEvaluationWindow(referenceTime: Date, timezone: string) {
    const workDate = toStartOfDay(referenceTime, timezone);
    return {
      workDate,
      startOfDay: workDate,
      endOfDay: toEndOfDay(referenceTime, timezone),
    };
  }

  private async buildAttendanceEvaluationInput(params: {
    attendance: RecomputeAttendanceInput["attendance"];
    timezone: string;
    workingHourMode: RecomputeAttendanceInput["workingHourMode"];
  }): Promise<AttendanceEvaluationInput> {
    const { attendance, timezone, workingHourMode } = params;
    const { workDate, startOfDay, endOfDay } = this.getEvaluationWindow(
      attendance.checkOut ?? attendance.checkIn,
      timezone,
    );
    const [persistedAttendance, leave, holiday, overtime] = await Promise.all([
      this.attendanceRepo.findFirstByUserAndDateRange(
        attendance.userId,
        attendance.tenantId,
        startOfDay,
        endOfDay,
      ),
      this.leaveRepo.findActiveLeaveForUserOnDate(
        attendance.userId,
        startOfDay,
        endOfDay,
        attendance.tenantId,
      ),
      this.holidayRepo.findFirstByTenantAndDateRange(
        attendance.tenantId,
        startOfDay,
        endOfDay,
      ),
      this.overtimeRepo.findActiveRequestByDate(
        attendance.userId,
        attendance.tenantId,
        startOfDay,
        endOfDay,
      ),
    ]);
    const effectiveAttendance = persistedAttendance ?? attendance;

    return {
      tenantId: attendance.tenantId,
      userId: attendance.userId,
      workDate,
      attendance: {
        status: effectiveAttendance.status as AttendanceStatus,
        checkIn: effectiveAttendance.checkIn,
        checkOut: effectiveAttendance.checkOut,
        geofenceStatus:
          typeof effectiveAttendance.geofenceStatus === "string"
            ? effectiveAttendance.geofenceStatus
            : null,
        geofenceSiteName:
          typeof effectiveAttendance.geofenceSiteName === "string"
            ? effectiveAttendance.geofenceSiteName
            : null,
      },
      leave: leave ? { type: leave.type, approved: true } : null,
      holiday: holiday ? { description: holiday.description } : null,
      approvedOvertime:
        overtime?.status === "APPROVED"
          ? (overtime as unknown as Record<string, unknown>)
          : null,
      schedule: this.buildEvaluationSchedule(workingHourMode),
    };
  }

  private buildEvaluationSchedule(
    workingHourMode: RecomputeAttendanceInput["workingHourMode"],
  ) {
    const normalizedMode = this.toWorkingHourMode(workingHourMode);
    return normalizedMode ? { workingHourMode: normalizedMode } : null;
  }

  private toWorkingHourMode(value: unknown): WorkingHourMode | null {
    return value === "FIXED" || value === "SHIFT" || value === "FLEXIBLE"
      ? value
      : null;
  }
}
