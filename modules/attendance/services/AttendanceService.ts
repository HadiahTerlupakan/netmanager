import { GeofenceService } from "./GeofenceService";
import { AttendanceValidationService } from "./AttendanceValidationService";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import { AttendanceDailyEvaluator } from "./AttendanceDailyEvaluator";
import { AttendanceEvaluationAuditService } from "./AttendanceEvaluationAuditService";
import { AttendanceReadService } from "./AttendanceReadService";
import { AttendanceReportService } from "./AttendanceReportService";
import { AttendanceMutationService } from "./AttendanceMutationService";
import { AttendanceEvaluationRecomputeService } from "./AttendanceEvaluationRecomputeService";
import { AttendanceMutationGeofenceService } from "./AttendanceMutationGeofenceService";
import { AttendanceMutationEventService } from "./AttendanceMutationEventService";
import { AttendanceSessionGuardService } from "./AttendanceSessionGuardService";
import type { CachedUserAttendanceSettings } from "./attendance-service-helpers";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { type CurrentAttendanceStatusResult } from "./attendance-current-status-helpers";
export type { CurrentAttendanceStatusResult } from "./attendance-current-status-helpers";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import {
  OvertimePayrollQueryService,
  OvertimeQueryService,
} from "@/modules/overtime";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { UserLookupService } from "@/modules/users";
import type { AttendanceEvaluationResult } from "../types/AttendanceEvaluation";
import type {
  CheckInParams,
  HistoricalAttendanceRecomputeResult,
} from "./attendance-service.contracts";
export type {
  CheckInParams,
  HistoricalAttendanceRecomputeResult,
} from "./attendance-service.contracts";
export class AttendanceService {
  private geofenceService: GeofenceService;
  private validationService: AttendanceValidationService;
  private timezoneService: AttendanceTimezoneService;
  private attendanceRepo: AttendanceRepository;
  private userRepo: UserLookupService;
  private attendanceEvaluator: AttendanceDailyEvaluator;
  private evaluationAuditService: AttendanceEvaluationAuditService;
  private leaveRepo: LeaveRepository;
  private holidayRepo: HolidayRepository;
  private overtimeRepo: OvertimeQueryService;
  private readService: AttendanceReadService;
  private reportService: AttendanceReportService;
  private mutationService: AttendanceMutationService;
  private recomputeService: AttendanceEvaluationRecomputeService;
  constructor() {
    this.geofenceService = new GeofenceService();
    this.validationService = new AttendanceValidationService();
    this.timezoneService = new AttendanceTimezoneService();
    this.attendanceRepo = new AttendanceRepository();
    this.userRepo = new UserLookupService();
    this.attendanceEvaluator = new AttendanceDailyEvaluator();
    this.evaluationAuditService = new AttendanceEvaluationAuditService();
    this.leaveRepo = new LeaveRepository();
    this.holidayRepo = new HolidayRepository();
    this.overtimeRepo = new OvertimeQueryService();
    this.readService = new AttendanceReadService({
      attendanceRepo: this.attendanceRepo,
      userRepo: this.userRepo,
      timezoneService: this.timezoneService,
    });
    this.reportService = new AttendanceReportService(
      this.attendanceRepo,
      new OvertimePayrollQueryService(),
      this.leaveRepo,
      this.userRepo,
    );
    this.recomputeService = new AttendanceEvaluationRecomputeService(
      this.attendanceRepo,
      this.attendanceEvaluator,
      this.evaluationAuditService,
      this.leaveRepo,
      this.holidayRepo,
      this.overtimeRepo,
    );
    this.mutationService = new AttendanceMutationService(
      new AttendanceMutationGeofenceService(this.geofenceService),
      new AttendanceMutationEventService(),
      new AttendanceSessionGuardService(this.attendanceRepo),
      this.validationService,
      this.timezoneService,
      this.attendanceRepo,
      this.userRepo,
      this.recomputeService,
    );
  }

  async checkIn(params: CheckInParams) {
    return this.mutationService.checkIn(params);
  }

  /** Auto-checkout sesi lama sebelum check-in baru dibuat. */
  async processAutoCheckout(input: {
    userId: string;
    userDetails: CachedUserAttendanceSettings | null;
    effectiveToday: Date;
    checkInTime: Date;
    tenantId?: string;
    timezone: string;
  }): Promise<void>;
  async processAutoCheckout(
    userId: string,
    userDetails: CachedUserAttendanceSettings | null,
    effectiveToday: Date,
    checkInTime: Date,
    tenantId: string | undefined,
    timezone: string,
  ): Promise<void>;
  async processAutoCheckout(
    inputOrUserId:
      | string
      | {
          userId: string;
          userDetails: CachedUserAttendanceSettings | null;
          effectiveToday: Date;
          checkInTime: Date;
          tenantId?: string;
          timezone: string;
        },
    userDetails?: CachedUserAttendanceSettings | null,
    effectiveToday?: Date,
    checkInTime?: Date,
    tenantId?: string,
    timezone?: string,
  ) {
    const input =
      typeof inputOrUserId === "string"
        ? {
            userId: inputOrUserId,
            userDetails: userDetails ?? null,
            effectiveToday: effectiveToday ?? new Date(),
            checkInTime: checkInTime ?? new Date(),
            tenantId,
            timezone: timezone ?? "UTC",
          }
        : inputOrUserId;
    const sessionGuardService = new AttendanceSessionGuardService(
      this.attendanceRepo,
    );
    return sessionGuardService.processAutoCheckout(input);
  }

  /** Centralized Check-Out Logic for web and mobile routes. */
  async checkOut(params: {
    userId: string;
    photoUrl: string | null;
    location: string | null;
    notes?: string;
    latitude?: number;
    longitude?: number;
    offlineTime?: Date;
    tenantId?: string;
  }) {
    return this.mutationService.checkOut(params);
  }

  /** Ambil data laporan attendance agregat tanpa mengubah format public API. */
  async getReportData(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    return this.reportService.getReportData({
      startDate,
      endDate,
      siteId,
      departmentId,
    });
  }
  async getAttendanceHistory(
    userId: string,
    params: { page: number; limit: number },
  ) {
    return this.readService.getAttendanceHistory(userId, params);
  }
  async recomputeHistoricalAttendanceEvaluations(params: {
    userId: string;
    tenantId: string;
    startDate: Date;
    endDate: Date;
    actorId: string;
  }): Promise<HistoricalAttendanceRecomputeResult> {
    const { userId, tenantId, startDate, endDate, actorId } = params;
    const timezone = await this.timezoneService.getTimezone(tenantId);
    const userDetails = await this.userRepo.findAttendanceSettingsById(userId);
    const attendances = await this.attendanceRepo.findMany({
      where: {
        userId,
        tenantId,
        checkIn: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { checkIn: "asc" },
    });
    const evaluations: AttendanceEvaluationResult[] = [];
    const joinDate = userDetails?.joinDate
      ? toStartOfDay(userDetails.joinDate, timezone)
      : null;
    for (const attendance of attendances) {
      if (joinDate && attendance.checkIn < joinDate) {
        continue;
      }
      const evaluation =
        await this.mutationService.recomputeAttendanceEvaluation({
          attendance: {
            tenantId: attendance.tenantId ?? tenantId,
            userId: attendance.userId,
            checkIn: attendance.checkIn,
            checkOut: attendance.checkOut,
            status: attendance.status,
          },
          timezone,
          workingHourMode: userDetails?.workingHourMode,
          actorId,
          audit: {
            reason: "historical attendance recompute",
            actorType: "admin",
          },
        });
      evaluations.push(evaluation);
    }
    return {
      processedCount: evaluations.length,
      evaluations,
    };
  }
  async getCurrentAttendanceStatus(
    userId: string,
    options?: { tenantId?: string },
  ): Promise<CurrentAttendanceStatusResult> {
    return this.readService.getCurrentAttendanceStatus(userId, options);
  }
  async getAttendanceConfig(userId: string) {
    return this.readService.getAttendanceConfig(userId);
  }
  async getAttendanceAnalytics(userId: string, days: number = 30) {
    return this.readService.getAttendanceAnalytics(userId, days);
  }
}
