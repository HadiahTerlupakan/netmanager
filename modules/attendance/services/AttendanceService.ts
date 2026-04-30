import type { CachedUserAttendanceSettings } from "./attendance-service-helpers";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { type CurrentAttendanceStatusResult } from "./attendance-current-status-helpers";
export type { CurrentAttendanceStatusResult } from "./attendance-current-status-helpers";
import type { AttendanceEvaluationResult } from "../types/AttendanceEvaluation";
import { createAttendanceServiceDependencies } from "./attendance-service-dependencies";
import type {
  CheckInParams,
  HistoricalAttendanceRecomputeResult,
} from "./attendance-service.contracts";
export type {
  CheckInParams,
  HistoricalAttendanceRecomputeResult,
} from "./attendance-service.contracts";
export class AttendanceService {
  private readonly dependencies = createAttendanceServiceDependencies();
  private readonly attendanceRepo = this.dependencies.attendanceRepo;
  private readonly timezoneService = this.dependencies.timezoneService;
  private readonly userRepo = this.dependencies.userRepo;
  private readonly readService = this.dependencies.readService;
  private readonly reportService = this.dependencies.reportService;
  private readonly mutationService = this.dependencies.mutationService;
  private readonly recomputeService = this.dependencies.recomputeService;
  private readonly sessionGuardService = this.dependencies.sessionGuardService;

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
    return this.sessionGuardService.processAutoCheckout(input);
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
    const attendances = await this.findAttendancesForRecompute({
      userId,
      tenantId,
      startDate,
      endDate,
    });
    const evaluations = await this.collectHistoricalEvaluations({
      attendances,
      tenantId,
      actorId,
      timezone,
      userDetails,
    });

    return {
      processedCount: evaluations.length,
      evaluations,
    };
  }

  /** Ambil attendance historis yang perlu direcompute. */
  private findAttendancesForRecompute(params: {
    userId: string;
    tenantId: string;
    startDate: Date;
    endDate: Date;
  }) {
    const { userId, tenantId, startDate, endDate } = params;
    return this.attendanceRepo.findMany({
      where: {
        userId,
        tenantId,
        checkIn: { gte: startDate, lte: endDate },
      },
      orderBy: { checkIn: "asc" },
    });
  }

  /** Kumpulkan hasil evaluasi historis setelah filter tanggal join. */
  private async collectHistoricalEvaluations(params: {
    attendances: Awaited<
      ReturnType<AttendanceService["findAttendancesForRecompute"]>
    >;
    tenantId: string;
    actorId: string;
    timezone: string;
    userDetails: Awaited<
      ReturnType<AttendanceService["userRepo"]["findAttendanceSettingsById"]>
    >;
  }): Promise<AttendanceEvaluationResult[]> {
    const { attendances, tenantId, actorId, timezone, userDetails } = params;
    const joinDate = this.getUserJoinDate(userDetails?.joinDate, timezone);
    const evaluations: AttendanceEvaluationResult[] = [];

    for (const attendance of attendances) {
      if (joinDate && attendance.checkIn < joinDate) continue;
      const evaluation = await this.recomputeSingleEvaluation({
        attendance,
        tenantId,
        actorId,
        timezone,
        workingHourMode: userDetails?.workingHourMode,
      });
      evaluations.push(evaluation);
    }

    return evaluations;
  }

  /** Hitung tanggal join efektif pada timezone tenant. */
  private getUserJoinDate(
    joinDate: Date | null | undefined,
    timezone: string,
  ): Date | null {
    return joinDate ? toStartOfDay(joinDate, timezone) : null;
  }

  /** Jalankan recompute untuk satu attendance historis. */
  private recomputeSingleEvaluation(params: {
    attendance: Awaited<
      ReturnType<AttendanceService["findAttendancesForRecompute"]>
    >[number];
    tenantId: string;
    actorId: string;
    timezone: string;
    workingHourMode?: string | null;
  }) {
    const { attendance, tenantId, actorId, timezone, workingHourMode } = params;
    return this.mutationService.recomputeAttendanceEvaluation({
      attendance: {
        tenantId: attendance.tenantId ?? tenantId,
        userId: attendance.userId,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        status: attendance.status,
      },
      timezone,
      workingHourMode,
      actorId,
      audit: {
        reason: "historical attendance recompute",
        actorType: "admin",
      },
    });
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
