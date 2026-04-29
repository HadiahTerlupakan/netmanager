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
  resolveCheckInStatus,
  resolveCheckInTimeContext,
  type CachedUserAttendanceSettings,
  formatCurrentAttendanceWarningDate,
  isSameAttendanceDay,
} from "./attendance-service-helpers";
import { getAttendanceAnalytics } from "./attendance-analytics-helpers";
import {
  buildAttendanceScoreResult,
  createUserScoreState,
  getStandardMinutesPerDay,
  toRoundedHours,
} from "./attendance-report-helpers";
import {
  buildIdleCurrentAttendanceStatus,
  getCurrentAttendanceWarningMessage,
  mapCurrentAttendanceStatusResult,
  mapPersistedAttendanceEvaluation,
  type ActiveAttendanceSessionRow,
  type CurrentAttendanceEvaluationRow,
  type CurrentAttendanceRow,
  type CurrentAttendanceStatusResult,
} from "./attendance-current-status-helpers";
export type { CurrentAttendanceStatusResult } from "./attendance-current-status-helpers";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import {
  OvertimePayrollQueryService,
  OvertimeQueryService,
} from "@/modules/overtime";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { UserLookupService } from "@/modules/users";
import { AttendanceEventDispatcher } from "@/modules/events";
import { logger } from "@/lib/logger";
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
    const eligibility = await this.validationService.validateCheckInEligibility(
      userId,
      tz,
      checkInTime,
      tenantId,
    );
    if (!eligibility.isValid) {
      throw new Error(`CHECKIN_REJECTED:${eligibility.reason}`); // Format error for controller to parse
    }
    const userDetails = await getCachedUserAttendanceSettings({
      userId,
      userRepo: this.userRepo,
    });
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
    const status = await resolveCheckInStatus({
      checkInTime,
      timezone: tz,
      userDetails,
      timezoneService: this.timezoneService,
    });
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
    const attendance = await this.attendanceRepo.findFirstActiveForCheckout({
      userId,
      tenantId,
    });
    if (!attendance) {
      throw new Error("NO_ACTIVE_SESSION");
    }
    const checkOutTime = offlineTime || new Date();
    const warning =
      attendance.user.workingHourMode === "FLEXIBLE"
        ? buildFlexibleCheckoutWarning({
            checkIn: attendance.checkIn,
            checkOutTime,
            targetHours: attendance.user.flexibleTargetHour || 8,
          })
        : undefined;
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
    const overtimeRepository = new OvertimePayrollQueryService();
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
    const userMap = new Map<string, ReturnType<typeof createUserScoreState>>();
    const getOrCreateUserScore = (userId: string) => {
      if (!userMap.has(userId)) userMap.set(userId, createUserScoreState());
      return userMap.get(userId)!;
    };

    /** Set jumlah hari hadir user pada periode laporan. */
    const applyAttendanceDays = (userId: string, count: number) => {
      getOrCreateUserScore(userId).days = count;
    };

    /** Tambahkan lembur resmi user pada periode laporan. */
    const applyOfficialOvertime = (userId: string, totalDuration: number) => {
      if (!userMap.has(userId)) return;
      getOrCreateUserScore(userId).officialOtMinutes += totalDuration;
    };

    /** Simpan jumlah alpha user pada periode laporan. */
    const applyAbsencePenalty = (userId: string, count: number) => {
      if (!userMap.has(userId)) return;
      getOrCreateUserScore(userId).alphaCount = count;
    };

    /** Simpan total menit kerja user pada periode laporan. */
    const applyTotalMinutes = (userId: string, totalMinutes: number) => {
      if (!userMap.has(userId)) return;
      getOrCreateUserScore(userId).totalMinutes = totalMinutes;
    };

    /** Cek apakah user punya hari hadir untuk scoring. */
    const hasAttendanceDays = (
      stats: ReturnType<typeof createUserScoreState>,
    ) => stats.days > 0;

    /** Format menit menjadi jam 1 desimal. */
    const formatHours = (totalMinutes: number) => toRoundedHours(totalMinutes);

    /** Ambil semua user dari statistik gabungan. */
    const allUserIds = new Set<string>([
      ...userAttStats.map((u) => u.userId),
      ...userAbsenceStats.map((u) => u.userId),
      ...userLeaveStats.map((u) => u.userId),
    ]);

    /** Hitung persen aman dari pembagi nol. */
    const calculateRate = (count: number, total: number) =>
      total > 0 ? (count / total) * 100 : 0;

    /** Bangun item summary karyawan. */
    const buildEmployeeSummaryItem = (
      userId: string,
      user:
        | Awaited<
            ReturnType<UserLookupService["findManyWithFullDetails"]>
          >[number]
        | undefined,
      hadir: number,
      terlambat: number,
      izin: number,
      alpha: number,
      lemburMinutes: number,
      totalMinutes: number,
    ) => ({
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
      lemburJam: formatHours(lemburMinutes),
      totalJamKerja: formatHours(totalMinutes),
    });

    /** Bangun top employee gabungan dengan detail user. */
    const buildCombinedTopEmployee = (
      scorer: ReturnType<typeof buildAttendanceScoreResult>,
      user:
        | Awaited<
            ReturnType<UserLookupService["findManyWithBasicInfo"]>
          >[number]
        | undefined,
    ) => ({ user, score: scorer.score, details: scorer.details });

    /** Ambil top scorer berdasar map score user. */
    const buildTopScorers = () =>
      Array.from(userMap.entries())
        .filter(([_, score]) => hasAttendanceDays(score))
        .map(([userId, score]) => buildAttendanceScoreResult(userId, score))
        .sort((left, right) => right.score - left.score)
        .slice(0, 5);

    /** Cari user basic info untuk top scorer. */
    const findTopScorerUser = (
      users: Awaited<ReturnType<UserLookupService["findManyWithBasicInfo"]>>,
      scorerUserId: string,
    ) => users.find((user) => user.id === scorerUserId);

    /** Ambil nilai map dengan default nol. */
    const getMapValue = (map: Map<string, number>, userId: string) =>
      map.get(userId) || 0;

    /** Bangun map statistik numerik user. */
    const createStatsMap = <T>(
      items: T[],
      getKey: (item: T) => string,
      getValue: (item: T) => number,
    ) => new Map(items.map((item) => [getKey(item), getValue(item)]));

    /** Bangun map detail user untuk summary. */
    const createUserDetailsMap = (
      users: Awaited<ReturnType<UserLookupService["findManyWithFullDetails"]>>,
    ) => new Map(users.map((user) => [user.id, user]));

    /** Bangun map konfigurasi jam kerja user. */
    const createUserConfigMap = (
      users: Awaited<ReturnType<UserLookupService["findManyWithWorkConfig"]>>,
    ) => new Map(users.map((user) => [user.id, user]));

    /** Terapkan kelebihan menit kerja di atas standar user. */
    const applyExcessMinutes = (
      userId: string,
      totalMinutes: number,
      userConfigMap: Map<
        string,
        Awaited<ReturnType<UserLookupService["findManyWithWorkConfig"]>>[number]
      >,
    ) => {
      if (!userMap.has(userId)) return;
      const current = getOrCreateUserScore(userId);
      if (!hasAttendanceDays(current)) return;
      const standardMinutes =
        current.days * getStandardMinutesPerDay(userId, userConfigMap as never);
      if (totalMinutes > standardMinutes)
        current.excessMinutes += totalMinutes - standardMinutes;
    };

    /** Hitung jumlah terlambat laporan. */
    const getLateCount = () => stats.statusCounts["LATE"] || 0;

    /** Hitung jumlah alpha laporan. */
    const getAlphaCount = () => evaluationStats.statusCounts["ABSENT"] || 0;

    /** Selesai menyiapkan helper lokal laporan attendance. */
    // 1. Base Attendance Days (ONLY users with actual ON_TIME/LATE attendance)
    userAttStats.forEach((item) => {
      applyAttendanceDays(item.userId, item._count._all);
    });
    // 2. Formal Overtime (Approved/Completed) - ONLY add to existing users with attendance
    userOtStats.forEach((item) => {
      // Skip if user has no attendance record (shouldn't appear in Star Employees)
      applyOfficialOvertime(item.userId, item.totalDuration || 0);
    });
    // 3. Absence Stats (Penalties) - ONLY for existing users
    userAbsenceStats.forEach((item) => {
      applyAbsencePenalty(item.userId, item._count._all);
    });
    // 4. Fetch User Work Hour Configuration for accurate standard hours calculation
    const userIds = Array.from(userMap.keys());
    const userConfigs =
      userIds.length > 0
        ? await this.userRepo.findManyWithWorkConfig(userIds)
        : [];
    // Create user config map for quick lookup
    const userConfigMap = createUserConfigMap(userConfigs);

    /** Konversi menit ke jam desimal untuk summary. */
    const buildSummaryHours = (minutes: number) => formatHours(minutes);

    /** Bangun item summary employee dari map statistik. */
    const createEmployeeSummary = (userId: string) => {
      const user = userDetailsMap.get(userId);
      const hadir = getMapValue(userAttMap, userId);
      const terlambat = getMapValue(userLateMap, userId);
      const izin = getMapValue(userLeaveMap, userId);
      const alpha = getMapValue(userAbsenceMap, userId);
      const lemburMinutes = getMapValue(userOtMap, userId);
      const totalMinutes = userTotalDuration.get(userId) || 0;
      return buildEmployeeSummaryItem(
        userId,
        user,
        hadir,
        terlambat,
        izin,
        alpha,
        lemburMinutes,
        totalMinutes,
      );
    };

    /** Tandai summary employee valid. */
    const isValidEmployeeSummary = (item: { user: unknown | null }) =>
      item.user !== null;

    /** Tandai top employee gabungan valid. */
    const isValidCombinedTopEmployee = (item: { user: unknown }) =>
      Boolean(item.user);

    /** Buat detail top employee gabungan. */
    const createCombinedTopEmployee = (
      scorer: ReturnType<typeof buildAttendanceScoreResult>,
      users: Awaited<ReturnType<UserLookupService["findManyWithBasicInfo"]>>,
    ) => {
      return buildCombinedTopEmployee(
        scorer,
        findTopScorerUser(users, scorer.userId),
      );
    };

    /** Selesaikan helper report setelah user detail tersedia. */
    void buildSummaryHours;
    void isValidCombinedTopEmployee;
    void isValidEmployeeSummary;
    void createCombinedTopEmployee;
    void createEmployeeSummary;
    // 5. Implicit Overtime & Total Duration - ONLY for existing users
    userTotalDuration.forEach((totalMinutes, userId) => {
      // Skip if user has no attendance record
      if (!userMap.has(userId)) return;
      applyTotalMinutes(userId, totalMinutes);
      applyExcessMinutes(userId, totalMinutes, userConfigMap);
    });
    // FILTER: Only include users with at least 1 day of attendance
    const topScorers = buildTopScorers();
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
        topScorers.map((scorer) => scorer.userId),
      );
      combinedTopEmployees = topScorers
        .map((scorer) => createCombinedTopEmployee(scorer, topScorerDetails))
        .filter(isValidCombinedTopEmployee);
    }
    // Calculate derived stats
    const lateCount = getLateCount();
    const lateRate = calculateRate(lateCount, stats.total);
    const alphaCount = getAlphaCount();
    const alphaRate = calculateRate(alphaCount, evaluationStats.total);
    // Build Employee Summary for "Rekap Karyawan" tab
    // Create maps for quick lookup
    const userLateMap = createStatsMap(
      userLateStats,
      (item) => item.userId,
      (item) => item._count._all,
    );
    const userLeaveMap = createStatsMap(
      userLeaveStats,
      (item) => item.userId,
      (item) => item._count._all,
    );
    const userAbsenceMap = createStatsMap(
      userAbsenceStats,
      (item) => item.userId,
      (item) => item._count._all,
    );
    const userOtMap = createStatsMap(
      userOtStats,
      (item) => item.userId,
      (item) => item.totalDuration || 0,
    );
    const userAttMap = createStatsMap(
      userAttStats,
      (item) => item.userId,
      (item) => item._count._all,
    );
    const allUsers = await this.userRepo.findManyWithFullDetails(
      Array.from(allUserIds),
    );
    const userDetailsMap = createUserDetailsMap(allUsers);
    const employeeSummary = Array.from(allUserIds)
      .map((userId) => createEmployeeSummary(userId))
      .filter(isValidEmployeeSummary);
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
    return getAttendanceAnalytics({
      userId,
      days,
      attendanceRepo: this.attendanceRepo,
      userRepo: this.userRepo,
    });
  }
}
