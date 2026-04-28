import { GeofenceService } from "./GeofenceService";
import { AttendanceValidationService } from "./AttendanceValidationService";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import { AttendanceSessionPolicyService } from "./AttendanceSessionPolicyService";
import {
  AttendanceDailyEvaluator,
  type AttendanceEvaluationInput,
} from "./AttendanceDailyEvaluator";
import { AttendanceEvaluationAuditService } from "./AttendanceEvaluationAuditService";
import { AttendanceStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import {
  buildFlexibleCheckoutWarning,
  getCachedUserAttendanceSettings,
  getScheduleEndTimeForPolicy,
  mergeAttendanceNotes,
  normalizeReasonCodes,
  normalizeSourceRefs,
  resolveCheckInStatus,
  resolveCheckInTimeContext,
  type CachedUserAttendanceSettings,
  formatCurrentAttendanceTime,
  formatCurrentAttendanceWarningDate,
  isSameAttendanceDay,
} from "./attendance-service-helpers";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { OvertimeRepository } from "@/modules/overtime/repositories/OvertimeRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { UserLookupService } from "@/modules/users";
import { AttendanceEventDispatcher } from "@/modules/events";
import { logger } from "@/lib/logger";
import type { AttendanceEvaluationResult } from "../types/AttendanceEvaluation";

interface CheckInParams {
  userId: string;
  photoUrl: string | null;
  location: string;
  notes: string;
  latitude?: number;
  longitude?: number;
  offlineTime?: Date; // For mobile offline sync
  timezone?: string;
  tenantId?: string;
}

type CurrentAttendanceUiStatus = "idle" | "checked-in" | "checked-out";

type CurrentAttendanceRow = {
  id: string;
  checkIn: Date;
  checkOut: Date | null;
  status: AttendanceStatus;
  user: {
    workingHourMode: "FIXED" | "SHIFT" | "FLEXIBLE" | null;
    flexibleTargetHour: number | null;
    shift: {
      startTime: string | null;
      endTime: string | null;
    } | null;
  } | null;
};

type ActiveAttendanceSessionRow = {
  id: string;
  checkIn: Date;
  checkOut: Date | null;
  status: AttendanceStatus;
  user: {
    workingHourMode: "FIXED" | "SHIFT" | "FLEXIBLE" | null;
    flexibleTargetHour: number | null;
    shift: {
      startTime: string | null;
      endTime: string | null;
    } | null;
  } | null;
};

type PersistedAttendanceEvaluationRow = Awaited<
  ReturnType<AttendanceRepository["findLatestEvaluationForUser"]>
>;

type CurrentAttendanceEvaluationRow = Pick<
  AttendanceEvaluationResult,
  "finalStatus" | "reviewState" | "reasonCodes" | "anomalyCodes"
> | null;

export type HistoricalAttendanceRecomputeResult = {
  processedCount: number;
  evaluations: AttendanceEvaluationResult[];
};

export type CurrentAttendanceStatusResult = {
  status: CurrentAttendanceUiStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  warningMessage: string | null;
  sourceAttendanceId: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  attendanceStatus: AttendanceStatus | null;
  workingHourMode: "FIXED" | "SHIFT" | "FLEXIBLE" | null;
  flexibleTargetHour: number | null;
  shift: {
    startTime: string | null;
    endTime: string | null;
  } | null;
};

function mapPersistedAttendanceEvaluation(
  evaluation: PersistedAttendanceEvaluationRow,
): AttendanceEvaluationResult | null {
  if (!evaluation) {
    return null;
  }

  return {
    tenantId: evaluation.tenantId,
    userId: evaluation.userId,
    workDate: evaluation.workDate,
    finalStatus: evaluation.finalStatus,
    reviewState:
      evaluation.reviewState as AttendanceEvaluationResult["reviewState"],
    rawPresenceState: evaluation.rawPresenceState,
    workMinutes: evaluation.workMinutes,
    lateMinutes: evaluation.lateMinutes,
    overtimeMinutesApproved: evaluation.overtimeMinutesApproved,
    overtimeMinutesHeld: evaluation.overtimeMinutesHeld,
    payrollHoldState:
      evaluation.payrollHoldState as AttendanceEvaluationResult["payrollHoldState"],
    holidayState: evaluation.holidayState,
    leaveState: evaluation.leaveState,
    scheduleState: evaluation.scheduleState,
    evidenceQuality: evaluation.evidenceQuality,
    reasonCodes: normalizeReasonCodes(evaluation.reasonCodes),
    anomalyCodes: normalizeReasonCodes(evaluation.anomalyCodes),
    sourceRefs: normalizeSourceRefs(evaluation.sourceRefs),
    evaluationVersion: evaluation.evaluationVersion,
    evaluatedAt: evaluation.evaluatedAt,
  };
}

function getCurrentAttendanceWarningMessage(
  evaluation: CurrentAttendanceEvaluationRow,
  fallbackWarningMessage: string | null,
): string | null {
  if (!evaluation) {
    return fallbackWarningMessage;
  }

  const [firstReason] = normalizeReasonCodes(evaluation.reasonCodes);
  return firstReason ?? fallbackWarningMessage;
}

function mapCurrentAttendanceStatusResult(params: {
  attendance: CurrentAttendanceRow;
  evaluation: CurrentAttendanceEvaluationRow;
  timezone: string;
  status: CurrentAttendanceUiStatus;
  warningMessage: string | null;
}): CurrentAttendanceStatusResult {
  const { attendance, evaluation, timezone, status, warningMessage } = params;

  return {
    status,
    checkInTime: formatCurrentAttendanceTime(attendance.checkIn, timezone),
    checkOutTime: formatCurrentAttendanceTime(attendance.checkOut, timezone),
    warningMessage,
    sourceAttendanceId: attendance.id,
    checkInAt: attendance.checkIn.toISOString(),
    checkOutAt: attendance.checkOut?.toISOString() ?? null,
    attendanceStatus: evaluation?.finalStatus ?? attendance.status,
    workingHourMode: attendance.user?.workingHourMode ?? null,
    flexibleTargetHour: attendance.user?.flexibleTargetHour ?? null,
    shift: attendance.user?.shift ?? null,
  };
}

function buildIdleCurrentAttendanceStatus(
  attendance?: CurrentAttendanceRow | null,
  warningMessage: string | null = null,
  evaluation?: CurrentAttendanceEvaluationRow,
): CurrentAttendanceStatusResult {
  return {
    status: "idle",
    checkInTime: null,
    checkOutTime: null,
    warningMessage,
    sourceAttendanceId: attendance?.id ?? null,
    checkInAt: attendance?.checkIn?.toISOString() ?? null,
    checkOutAt: attendance?.checkOut?.toISOString() ?? null,
    attendanceStatus: evaluation?.finalStatus ?? attendance?.status ?? null,
    workingHourMode: attendance?.user?.workingHourMode ?? null,
    flexibleTargetHour: attendance?.user?.flexibleTargetHour ?? null,
    shift: attendance?.user?.shift ?? null,
  };
}

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
  private overtimeRepo: OvertimeRepository;

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
    this.overtimeRepo = new OvertimeRepository();
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
      leave: leave
        ? {
            type: leave.type,
            approved: true,
          }
        : null,
      holiday: holiday
        ? {
            description: holiday.description,
          }
        : null,
      approvedOvertime:
        overtime?.status === "APPROVED"
          ? (overtime as unknown as Record<string, unknown>)
          : null,
      schedule:
        workingHourMode === "FIXED" ||
        workingHourMode === "SHIFT" ||
        workingHourMode === "FLEXIBLE"
          ? {
              workingHourMode,
            }
          : null,
    };
  }

  private async recomputeAttendanceEvaluation(params: {
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
    audit: {
      reason: string;
      actorType: string;
    };
  }): Promise<AttendanceEvaluationResult> {
    const { attendance, timezone, workingHourMode, actorId, audit } = params;
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

  private async assertNoActiveSessionConflict(
    userId: string,
    userDetails: CachedUserAttendanceSettings | null,
    atTime: Date,
    timezone: string,
    tenantId?: string,
  ) {
    const latestOpenAttendance =
      (await this.attendanceRepo.findFirstOpenSession({
        userId,
        tenantId,
      })) as ActiveAttendanceSessionRow | null;

    if (!latestOpenAttendance) {
      return;
    }

    const workingHourMode =
      latestOpenAttendance.user?.workingHourMode ??
      (userDetails?.workingHourMode as "FIXED" | "SHIFT" | "FLEXIBLE" | null) ??
      null;
    const shift =
      latestOpenAttendance.user?.shift ?? userDetails?.shift ?? null;
    const sessionPolicyService = new AttendanceSessionPolicyService();
    const decision = sessionPolicyService.resolve({
      attendance: {
        id: latestOpenAttendance.id,
        checkIn: latestOpenAttendance.checkIn,
        checkOut: latestOpenAttendance.checkOut,
        status: latestOpenAttendance.status,
        user: {
          workingHourMode,
          flexibleTargetHour:
            latestOpenAttendance.user?.flexibleTargetHour ?? null,
          shift,
        },
      },
      now: atTime,
      scheduleEndTime: getScheduleEndTimeForPolicy(
        workingHourMode,
        userDetails,
        shift,
      ),
      timezone,
    });

    if (decision.isStaleFlexibleSession || !decision.shouldAutoCheckout) {
      throw new Error("DUPLICATE_ENTRY");
    }
  }

  async checkIn(params: CheckInParams) {
    const {
      userId,
      photoUrl,
      location,
      notes,
      latitude,
      longitude,
      offlineTime,
      timezone,
      tenantId,
    } = params;

    // 1. Timezone & Date Context
    // Use offlineTime if provided (trusted for sync), else server time
    const {
      timezone: tz,
      checkInTime,
      effectiveToday,
    } = await resolveCheckInTimeContext({
      offlineTime,
      timezone,
      tenantId,
      timezoneService: this.timezoneService,
    });
    // 2. Cross-Module Validation (Leave & Holiday)
    // Check using the User's Timezone Date
    const eligibility = await this.validationService.validateCheckInEligibility(
      userId,
      tz,
      checkInTime,
      tenantId,
    );
    if (!eligibility.isValid) {
      throw new Error(`CHECKIN_REJECTED:${eligibility.reason}`); // Format error for controller to parse
    }

    // 3. User Settings & Schedule (with Redis caching for cross-pod consistency)
    const userDetails = await getCachedUserAttendanceSettings({
      userId,
      userRepo: this.userRepo,
    });

    // 4. Auto-Checkout Stale Sessions
    await this.processAutoCheckout(
      userId,
      userDetails,
      effectiveToday,
      checkInTime,
      tenantId,
      tz,
    );

    await this.assertNoActiveSessionConflict(
      userId,
      userDetails,
      checkInTime,
      tz,
      tenantId,
    );

    // 5. Geofence Validation (before transaction to minimize lock time)
    let geofenceResult = {
      status: "UNKNOWN",
      distance: null as number | null,
      siteName: null as string | null,
    };

    if (latitude !== undefined && longitude !== undefined) {
      const geoCheck = await this.geofenceService.validateGeofence(
        userId,
        latitude,
        longitude,
      );
      const geofencePolicy = userDetails?.attendanceGeofencePolicy ?? "WARN";

      if (!geoCheck.isInside && geofencePolicy === "STRICT") {
        throw new Error("OUTSIDE_GEOFENCE");
      }

      geofenceResult = {
        status: geoCheck.isInside ? "INSIDE" : "OUTSIDE",
        distance: geoCheck.nearestDistance,
        siteName: geoCheck.nearestSiteName,
      };
    }

    // 6. Status Calculation (LATE vs ON_TIME)
    const status = await resolveCheckInStatus({
      checkInTime,
      timezone: tz,
      userDetails,
      timezoneService: this.timezoneService,
    });
    // 7. Create Record with transaction to prevent race condition
    // checkInDate is the date-only portion in the user's timezone,
    // used for the unique constraint to prevent duplicate check-ins per day
    const createData: Prisma.AttendanceUncheckedCreateInput = {
      id: randomUUID(),
      userId,
      tenantId,
      checkIn: checkInTime,
      checkInDate: effectiveToday,
      checkInPhoto: photoUrl,
      location,
      notes,
      status,
      geofenceStatus: geofenceResult.status,
      geofenceDistance: geofenceResult.distance,
      geofenceSiteName: geofenceResult.siteName,
      updatedAt: new Date(),
    };

    if (offlineTime) {
      createData.geofenceMeta = {
        offline: true,
        capturedAt: offlineTime.toISOString(),
      };
    }

    try {
      const result = await this.attendanceRepo.create(createData);
      const normalizedTenantId = result.tenantId ?? tenantId;

      if (!normalizedTenantId) {
        throw new Error("TENANT_REQUIRED_FOR_EVALUATION");
      }

      const evaluation = await this.recomputeAttendanceEvaluation({
        attendance: {
          tenantId: normalizedTenantId,
          userId: result.userId,
          checkIn: result.checkIn,
          checkOut: result.checkOut,
          status: result.status,
        },
        timezone: tz,
        workingHourMode: userDetails?.workingHourMode,
        actorId: userId,
        audit: {
          reason: "attendance mutation recompute",
          actorType: "user",
        },
      });

      // Publish domain event
      AttendanceEventDispatcher.onCheckIn({
        userId,
        attendanceId: result.id,
        timestamp: checkInTime.toISOString(),
        tenantId,
        location:
          latitude !== undefined && longitude !== undefined
            ? { lat: latitude, lng: longitude }
            : undefined,
      }).catch((err) =>
        logger.error(
          "Failed to publish ATTENDANCE_CHECKIN event",
          err instanceof Error ? err : undefined,
        ),
      );

      return {
        attendance: result,
        evaluation,
      };
    } catch (error) {
      // P2002 = Unique constraint violation → duplicate check-in caught by DB
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error("DUPLICATE_ENTRY");
      }
      throw error;
    }
  }

  private async processAutoCheckout(
    userId: string,
    userDetails: {
      endWorkTime: string | null;
      workingHourMode: string | null;
      shift?: { startTime: string; endTime: string } | null;
    } | null,
    effectiveToday: Date,
    policyNow: Date,
    tenantId: string | undefined,
    timezone: string,
  ) {
    const sessionPolicyService = new AttendanceSessionPolicyService();

    const staleSessions = await this.attendanceRepo.findManyStaleSessions({
      userId,
      effectiveToday,
      tenantId,
    });

    if (staleSessions.length === 0) return;

    await Promise.all(
      staleSessions.map(
        async (session: {
          id: string;
          checkIn: Date;
          checkOut: Date | null;
          status: string;
          notes: string | null;
        }) => {
          const decision = sessionPolicyService.resolve({
            attendance: {
              id: session.id,
              checkIn: session.checkIn,
              checkOut: session.checkOut,
              status: session.status as AttendanceStatus,
              user: {
                workingHourMode:
                  (userDetails?.workingHourMode as
                    | "FIXED"
                    | "SHIFT"
                    | "FLEXIBLE"
                    | null) ?? null,
                flexibleTargetHour: null,
                shift: userDetails?.shift
                  ? {
                      startTime: userDetails.shift.startTime,
                      endTime: userDetails.shift.endTime,
                    }
                  : null,
              },
            },
            now: policyNow,
            scheduleEndTime: getScheduleEndTimeForPolicy(
              userDetails?.workingHourMode,
              userDetails,
              userDetails?.shift,
            ),
            timezone,
          });

          const updateData = sessionPolicyService.buildAutoCheckoutUpdate({
            decision,
            existingNotes: session.notes,
          });

          if (!updateData) {
            return;
          }

          await this.attendanceRepo.update(session.id, updateData);
        },
      ),
    );
  }

  /**
   * Centralized Check-Out Logic
   * Used by both web and mobile routes for consistency
   */
  async checkOut(params: {
    userId: string;
    photoUrl: string | null;
    location: string | null;
    notes?: string;
    latitude?: number;
    longitude?: number;
    offlineTime?: Date;
    tenantId?: string;
  }): Promise<{
    attendance: Prisma.AttendanceGetPayload<{ include: { user: true } }>;
    evaluation: AttendanceEvaluationResult;
    warning?: string;
  }> {
    const {
      userId,
      photoUrl,
      location,
      notes,
      latitude,
      longitude,
      offlineTime,
      tenantId,
    } = params;

    // 1. Find active attendance
    const attendance = await this.attendanceRepo.findFirstActiveForCheckout({
      userId,
      tenantId,
    });

    if (!attendance) {
      throw new Error("NO_ACTIVE_SESSION");
    }

    const checkOutTime = offlineTime || new Date();

    // 2. Calculate warning for FLEXIBLE users
    const warning =
      attendance.user.workingHourMode === "FLEXIBLE"
        ? buildFlexibleCheckoutWarning({
            checkIn: attendance.checkIn,
            checkOutTime,
            targetHours: attendance.user.flexibleTargetHour || 8,
          })
        : undefined;

    // 3. Geofence validation
    let checkOutGeofenceStatus = "UNKNOWN";
    let checkOutGeofenceDistance: number | null = null;

    if (latitude !== undefined && longitude !== undefined) {
      const geoCheck = await this.geofenceService.validateGeofence(
        userId,
        latitude,
        longitude,
      );
      const geofencePolicy = attendance.user.attendanceGeofencePolicy ?? "WARN";

      if (!geoCheck.isInside && geofencePolicy === "STRICT") {
        throw new Error("OUTSIDE_GEOFENCE");
      }

      checkOutGeofenceStatus = geoCheck.isInside ? "INSIDE" : "OUTSIDE";
      checkOutGeofenceDistance = geoCheck.nearestDistance;
    }

    // 4. Prepare notes
    const finalNotes = mergeAttendanceNotes({
      existingNotes: attendance.notes,
      checkoutNotes: notes,
    });

    // 5. Update record
    const updateData: Prisma.AttendanceUncheckedUpdateInput = {
      checkOut: checkOutTime,
      checkOutPhoto: photoUrl,
      checkOutLocation: location ?? null,
      checkOutGeofenceStatus,
      checkOutGeofenceDistance,
      notes: finalNotes,
      status: attendance.status,
      updatedAt: new Date(),
    };

    const updatedAttendance = await this.attendanceRepo.update(
      attendance.id,
      updateData,
    );
    const normalizedTenantId = updatedAttendance.tenantId ?? tenantId;

    if (!normalizedTenantId) {
      throw new Error("TENANT_REQUIRED_FOR_EVALUATION");
    }

    const evaluation = await this.recomputeAttendanceEvaluation({
      attendance: {
        tenantId: normalizedTenantId,
        userId: updatedAttendance.userId,
        checkIn: updatedAttendance.checkIn,
        checkOut: updatedAttendance.checkOut,
        status: updatedAttendance.status,
      },
      timezone: await this.timezoneService.getTimezone(normalizedTenantId),
      workingHourMode: attendance.user.workingHourMode,
      actorId: userId,
      audit: {
        reason: "attendance mutation recompute",
        actorType: "user",
      },
    });

    // Publish domain event
    AttendanceEventDispatcher.onCheckOut({
      userId,
      userName: attendance.user.name || undefined,
      attendanceId: attendance.id,
      timestamp: checkOutTime.toISOString(),
      tenantId,
      location:
        latitude !== undefined && longitude !== undefined
          ? { lat: latitude, lng: longitude }
          : undefined,
    }).catch((err) =>
      logger.error(
        "Failed to publish ATTENDANCE_CHECKOUT event",
        err instanceof Error ? err : undefined,
      ),
    );

    const result: {
      attendance: Prisma.AttendanceGetPayload<{ include: { user: true } }>;
      evaluation: AttendanceEvaluationResult;
      warning?: string;
    } = {
      attendance: updatedAttendance as Prisma.AttendanceGetPayload<{
        include: { user: true };
      }>,
      evaluation,
    };
    if (warning) result.warning = warning;

    return result;
  }

  async getReportData(
    startDate: Date,
    endDate: Date,
    siteId?: string,
    departmentId?: string,
  ) {
    const repository = new AttendanceRepository();
    const overtimeRepository = new OvertimeRepository();
    const leaveRepository = new LeaveRepository();

    const [
      stats,
      evaluationStats,
      dailyStats,
      groupedBySite,
      groupedByDept,
      topEmployees,
      userAttStats,
      userOtStats,
      topAbsentees,
      userTotalDuration,
      userAbsenceStats,
      userLateStats,
      userLeaveStats,
    ] = await Promise.all([
      repository.getStatsByDateRange(startDate, endDate, siteId, departmentId),
      repository.getEvaluationStatsByDateRange(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      repository.getDailyStats(startDate, endDate, siteId, departmentId),
      repository.getGroupedStats(startDate, endDate, "site"),
      repository.getGroupedStats(startDate, endDate, "department"),
      repository.getTopEmployees(startDate, endDate, 5, siteId, departmentId),
      repository.getUserAttendanceStats(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      overtimeRepository.getUserOvertimeStats(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
      repository.getTopAbsentees(startDate, endDate, 5, siteId, departmentId),
      repository.getUserTotalDuration(startDate, endDate, siteId, departmentId),
      repository.getUserAbsenceStats(startDate, endDate, siteId, departmentId),
      repository.getUserLateStats(startDate, endDate, siteId, departmentId),
      leaveRepository.getUserLeaveStats(
        startDate,
        endDate,
        siteId,
        departmentId,
      ),
    ]);

    // Calculate Combined Top Employees (Star Employees)
    const userMap = new Map<
      string,
      {
        days: number;
        officialOtMinutes: number;
        excessMinutes: number;
        totalMinutes: number;
        alphaCount: number;
      }
    >();

    // 1. Base Attendance Days (ONLY users with actual ON_TIME/LATE attendance)
    userAttStats.forEach((item) => {
      if (!userMap.has(item.userId))
        userMap.set(item.userId, {
          days: 0,
          officialOtMinutes: 0,
          excessMinutes: 0,
          totalMinutes: 0,
          alphaCount: 0,
        });
      const current = userMap.get(item.userId)!;
      current.days = item._count._all;
    });

    // 2. Formal Overtime (Approved/Completed) - ONLY add to existing users with attendance
    userOtStats.forEach((item) => {
      // Skip if user has no attendance record (shouldn't appear in Star Employees)
      if (!userMap.has(item.userId)) return;
      const current = userMap.get(item.userId)!;
      current.officialOtMinutes += item.totalDuration || 0;
    });

    // 3. Absence Stats (Penalties) - ONLY for existing users
    userAbsenceStats.forEach((item) => {
      if (!userMap.has(item.userId)) return;
      const current = userMap.get(item.userId)!;
      current.alphaCount = item._count._all;
    });

    // 4. Fetch User Work Hour Configuration for accurate standard hours calculation
    const userIds = Array.from(userMap.keys());
    const userConfigs =
      userIds.length > 0
        ? await this.userRepo.findManyWithWorkConfig(userIds)
        : [];

    // Create user config map for quick lookup
    const userConfigMap = new Map(userConfigs.map((u) => [u.id, u]));

    // Helper function to calculate standard work minutes per day for a user
    const getStandardMinutesPerDay = (userId: string): number => {
      const config = userConfigMap.get(userId);
      if (!config) return 480; // Default 8 hours if no config found

      switch (config.workingHourMode) {
        case "FIXED":
          // Calculate from startWorkTime and endWorkTime (format: "HH:mm")
          if (config.startWorkTime && config.endWorkTime) {
            const startParts = config.startWorkTime.split(":").map(Number);
            const endParts = config.endWorkTime.split(":").map(Number);

            const startH = startParts[0] ?? 0;
            const startM = startParts[1] ?? 0;
            const endH = endParts[0] ?? 0;
            const endM = endParts[1] ?? 0;

            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;
            // Handle overnight (end < start)
            return endMinutes >= startMinutes
              ? endMinutes - startMinutes
              : 24 * 60 - startMinutes + endMinutes;
          }
          return 480; // Default 8 hours

        case "SHIFT":
          // Calculate from shift times
          if (config.shift?.startTime && config.shift?.endTime) {
            const startParts = config.shift.startTime.split(":").map(Number);
            const endParts = config.shift.endTime.split(":").map(Number);

            const startH = startParts[0] ?? 0;
            const startM = startParts[1] ?? 0;
            const endH = endParts[0] ?? 0;
            const endM = endParts[1] ?? 0;

            const startMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;
            // Handle overnight shift
            return endMinutes >= startMinutes
              ? endMinutes - startMinutes
              : 24 * 60 - startMinutes + endMinutes;
          }
          return 480; // Default 8 hours

        case "FLEXIBLE":
          // Use flexibleTargetHour (in hours)
          return (config.flexibleTargetHour || 8) * 60;

        default:
          return 480; // Default 8 hours
      }
    };

    // 5. Implicit Overtime & Total Duration - ONLY for existing users
    userTotalDuration.forEach((totalMinutes, userId) => {
      // Skip if user has no attendance record
      if (!userMap.has(userId)) return;
      const current = userMap.get(userId)!;

      // Set absolute total working minutes
      current.totalMinutes = totalMinutes;

      // Calculate Standard Work Minutes based on user's ACTUAL work hour configuration
      // Only calculate excess if user has actual attendance days
      if (current.days > 0) {
        const standardMinutesPerDay = getStandardMinutesPerDay(userId);
        const standardMinutes = current.days * standardMinutesPerDay;

        if (totalMinutes > standardMinutes) {
          const excess = totalMinutes - standardMinutes;
          // Add excess minutes to record
          current.excessMinutes += excess;
        }
      }
    });

    // FILTER: Only include users with at least 1 day of attendance
    const scoredUsers = Array.from(userMap.entries())
      .filter(([_, stats]) => stats.days > 0) // Must have attendance
      .map(([userId, stats]) => {
        // Scoring System:
        // 1 Day Present = 10 pts
        // 1 Day Alpha = -20 pts (Penalty)
        // Official Overtime = 2 pts/hour (1 pt per 30 mins)
        // Extra/Excess Overtime = 4 pts/hour (1 pt per 15 mins)

        const officialScore = Math.floor(stats.officialOtMinutes / 30);
        const excessScore = Math.floor(stats.excessMinutes / 15);
        const alphaPenalty = stats.alphaCount * 20;

        const totalOtMinutes = stats.officialOtMinutes + stats.excessMinutes;
        const score =
          stats.days * 10 + officialScore + excessScore - alphaPenalty;

        return {
          userId,
          score,
          details: {
            days: stats.days,
            alphaCount: stats.alphaCount,
            otHours: parseFloat((totalOtMinutes / 60).toFixed(1)), // Total OT
            officialOtHours: parseFloat(
              (stats.officialOtMinutes / 60).toFixed(1),
            ), // Resmi
            excessHours: parseFloat((stats.excessMinutes / 60).toFixed(1)), // Ekstra
            totalHours: parseFloat((stats.totalMinutes / 60).toFixed(1)), // Total Jam Kerja
          },
        };
      });

    // Sort by Score DESC
    scoredUsers.sort((a, b) => b.score - a.score);

    // Take Top 5
    const topScorers = scoredUsers.slice(0, 5);

    // Fetch User Details
    let combinedTopEmployees: Array<{
      user:
        | {
            id: string;
            name: string | null;
            image: string | null;
            sites: { name: string } | null;
            departments: { name: string } | null;
          }
        | undefined;
      score: number;
      details: Record<string, unknown>;
    }> = [];

    if (topScorers.length > 0) {
      const topScorerDetails = await this.userRepo.findManyWithBasicInfo(
        topScorers.map((u) => u.userId),
      );

      combinedTopEmployees = topScorers
        .map((scorer) => {
          const user = topScorerDetails.find((u) => u.id === scorer.userId);
          return {
            user,
            score: scorer.score,
            details: scorer.details,
          };
        })
        .filter((u) => u.user);
    }

    // Calculate derived stats
    const lateCount = stats.statusCounts["LATE"] || 0;
    const lateRate = stats.total > 0 ? (lateCount / stats.total) * 100 : 0;

    const alphaCount = evaluationStats.statusCounts["ABSENT"] || 0;
    const alphaRate =
      evaluationStats.total > 0
        ? (alphaCount / evaluationStats.total) * 100
        : 0;

    // Build Employee Summary for "Rekap Karyawan" tab
    // Create maps for quick lookup
    const userLateMap = new Map(
      userLateStats.map((u) => [u.userId, u._count._all]),
    );
    const userLeaveMap = new Map(
      userLeaveStats.map((u) => [u.userId, u._count._all]),
    );
    const userAbsenceMap = new Map(
      userAbsenceStats.map((u) => [u.userId, u._count._all]),
    );
    const userOtMap = new Map(
      userOtStats.map((u) => [u.userId, u.totalDuration || 0]),
    );
    const userAttMap = new Map(
      userAttStats.map((u) => [u.userId, u._count._all]),
    );

    // Get all unique user IDs from all stats
    const allUserIds = new Set<string>([
      ...userAttStats.map((u) => u.userId),
      ...userAbsenceStats.map((u) => u.userId),
      ...userLeaveStats.map((u) => u.userId),
    ]);

    // Fetch all user details in one query
    const allUsers = await this.userRepo.findManyWithFullDetails(
      Array.from(allUserIds),
    );

    const userDetailsMap = new Map(allUsers.map((u) => [u.id, u]));

    const employeeSummary = Array.from(allUserIds)
      .map((userId) => {
        const user = userDetailsMap.get(userId);
        const hadir = userAttMap.get(userId) || 0;
        const terlambat = userLateMap.get(userId) || 0;
        const izin = userLeaveMap.get(userId) || 0;
        const alpha = userAbsenceMap.get(userId) || 0;
        const lemburMinutes = userOtMap.get(userId) || 0;
        const totalMinutes = userTotalDuration.get(userId) || 0;

        return {
          userId,
          user: user
            ? {
                id: user.id,
                name: user.name,
                image: user.image,
                site: user.sites,
                department: user.departments,
              }
            : null,
          hadir,
          terlambat,
          izin,
          alpha,
          lemburJam: parseFloat((lemburMinutes / 60).toFixed(1)),
          totalJamKerja: parseFloat((totalMinutes / 60).toFixed(1)),
        };
      })
      .filter((e) => e.user !== null);

    return {
      summary: {
        totalAttendance: stats.total,
        attendanceRate: 0, // Placeholder
        avgDurationMinutes: stats.avgDurationMinutes,
        lateCount,
        lateRate,
        alphaCount,
        alphaRate,
      },
      trends: dailyStats,
      bySite: groupedBySite,
      byDepartment: groupedByDept,
      topEmployees,
      combinedTopEmployees,
      topAbsentees,
      employeeSummary,
    };
  }

  async getAttendanceHistory(
    userId: string,
    params: { page: number; limit: number },
  ) {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
    const userDetails = await this.userRepo.findAttendanceSettingsById(userId);
    const joinDate = userDetails?.joinDate ?? undefined;

    const [attendances, total] = await Promise.all([
      this.attendanceRepo.findManyForHistory({
        userId,
        skip,
        take: limit,
        joinDate,
      }),
      this.attendanceRepo.countByUserId(userId, joinDate),
    ]);
    const filteredAttendances = attendances.filter(
      (attendance) => !joinDate || attendance.checkIn >= joinDate,
    );
    const filteredTotal = joinDate ? filteredAttendances.length + skip : total;

    return {
      attendances: filteredAttendances,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit),
      },
    };
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
      const evaluation = await this.recomputeAttendanceEvaluation({
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
    const sessionPolicyService = new AttendanceSessionPolicyService();

    const timezone = await this.timezoneService.getTimezone(options?.tenantId);
    const effectiveDate = this.timezoneService.getEffectiveDate(timezone);
    const [attendance, evaluation] = await Promise.all([
      this.attendanceRepo.findFirstForCurrentStatus({
        userId,
        tenantId: options?.tenantId,
      }) as Promise<CurrentAttendanceRow | null>,
      this.attendanceRepo.findLatestEvaluationForUser({
        userId,
        tenantId: options?.tenantId,
        workDate: effectiveDate.startOfDay,
      }) as Promise<CurrentAttendanceEvaluationRow>,
    ]);

    const decision = attendance
      ? sessionPolicyService.resolve({
          attendance,
          now: new Date(),
          scheduleEndTime: null,
        })
      : null;

    if (!attendance) {
      return buildIdleCurrentAttendanceStatus(undefined, null, evaluation);
    }

    const evaluationWarningMessage = getCurrentAttendanceWarningMessage(
      evaluation,
      null,
    );

    if (decision?.isStaleFlexibleSession) {
      return buildIdleCurrentAttendanceStatus(
        attendance,
        getCurrentAttendanceWarningMessage(
          evaluation,
          `Sesi fleksibel lama sejak ${formatCurrentAttendanceWarningDate(attendance.checkIn, timezone)} belum checkout.`,
        ),
        evaluation,
      );
    }

    const sameDay = isSameAttendanceDay(
      attendance.checkIn,
      new Date(),
      timezone,
    );
    const shouldAppearActive =
      decision?.isOvernightShiftActive ||
      attendance.user?.workingHourMode === "FLEXIBLE" ||
      sameDay;

    if (!attendance.checkOut && shouldAppearActive) {
      return mapCurrentAttendanceStatusResult({
        attendance,
        evaluation,
        timezone,
        status: "checked-in",
        warningMessage: evaluationWarningMessage,
      });
    }

    if (attendance.checkOut && sameDay) {
      return mapCurrentAttendanceStatusResult({
        attendance,
        evaluation,
        timezone,
        status: "checked-out",
        warningMessage: evaluationWarningMessage,
      });
    }

    return buildIdleCurrentAttendanceStatus(
      attendance,
      evaluationWarningMessage,
      evaluation,
    );
  }

  async getAttendanceConfig(userId: string) {
    const user = await this.userRepo.findWithSitesById(userId);

    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    return {
      site: user.sites,
    };
  }

  async getAttendanceAnalytics(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();
    const userDetails = await this.userRepo.findAttendanceSettingsById(userId);

    const userAttendances = (
      await this.attendanceRepo.findManyForAnalytics({
        userId,
        startDate,
        endDate,
      })
    ).filter(
      (attendance) =>
        !userDetails?.joinDate || attendance.checkIn >= userDetails.joinDate,
    );

    const totalDays = userAttendances.length;
    const onTimeDays = userAttendances.filter(
      (a) => a.status === "ON_TIME",
    ).length;
    const lateDays = userAttendances.filter((a) => a.status === "LATE").length;

    let totalMinutes = 0;
    userAttendances.forEach((att) => {
      if (att.checkOut) {
        const diff =
          new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime();
        totalMinutes += diff / (1000 * 60);
      }
    });

    const stats = {
      totalDays,
      onTimeDays,
      lateDays,
      totalWorkHours: totalMinutes / 60,
      avgWorkHours: totalDays > 0 ? totalMinutes / 60 / totalDays : 0,
      onTimeRate: totalDays > 0 ? (onTimeDays / totalDays) * 100 : 0,
      lateRate: totalDays > 0 ? (lateDays / totalDays) * 100 : 0,
    };

    const weeklyBreakdown = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekAttendances = userAttendances.filter((a) => {
        const checkIn = new Date(a.checkIn);
        return checkIn >= weekStart && checkIn < weekEnd;
      });

      weeklyBreakdown.push({
        week: i + 1,
        startDate: weekStart,
        endDate: weekEnd,
        totalDays: weekAttendances.length,
        onTimeDays: weekAttendances.filter((a) => a.status === "ON_TIME")
          .length,
        lateDays: weekAttendances.filter((a) => a.status === "LATE").length,
      });
    }

    return {
      stats,
      weeklyBreakdown,
      recentAttendance: userAttendances.slice(0, 10),
      period: {
        startDate,
        endDate,
        days,
      },
    };
  }
}
