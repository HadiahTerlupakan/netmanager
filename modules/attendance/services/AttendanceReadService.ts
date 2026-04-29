import { AttendanceSessionPolicyService } from "./AttendanceSessionPolicyService";
import { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import { getAttendanceAnalytics } from "./attendance-analytics-helpers";
import {
  buildIdleCurrentAttendanceStatus,
  getCurrentAttendanceWarningMessage,
  mapCurrentAttendanceStatusResult,
  type CurrentAttendanceEvaluationRow,
  type CurrentAttendanceRow,
  type CurrentAttendanceStatusResult,
} from "./attendance-current-status-helpers";
import {
  formatCurrentAttendanceWarningDate,
  isSameAttendanceDay,
} from "./attendance-service-helpers";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { UserLookupService } from "@/modules/users";

type AttendanceReadDependencies = {
  attendanceRepo?: AttendanceRepository;
  userRepo?: UserLookupService;
  timezoneService?: AttendanceTimezoneService;
  sessionPolicyService?: AttendanceSessionPolicyService;
};

export class AttendanceReadService {
  private readonly attendanceRepo: AttendanceRepository;
  private readonly userRepo: UserLookupService;
  private readonly timezoneService: AttendanceTimezoneService;
  private readonly sessionPolicyService: AttendanceSessionPolicyService;

  constructor(dependencies: AttendanceReadDependencies = {}) {
    this.attendanceRepo =
      dependencies.attendanceRepo ?? new AttendanceRepository();
    this.userRepo = dependencies.userRepo ?? new UserLookupService();
    this.timezoneService =
      dependencies.timezoneService ?? new AttendanceTimezoneService();
    this.sessionPolicyService =
      dependencies.sessionPolicyService ?? new AttendanceSessionPolicyService();
  }

  /** Get paginated attendance history for a user. */
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

  /** Get attendance site configuration for a user. */
  async getAttendanceConfig(userId: string) {
    const user = await this.userRepo.findWithSitesById(userId);
    if (!user) throw new Error("USER_NOT_FOUND");

    return { site: user.sites };
  }

  /** Get attendance analytics for a user. */
  async getAttendanceAnalytics(userId: string, days: number = 30) {
    return getAttendanceAnalytics({
      userId,
      days,
      attendanceRepo: this.attendanceRepo,
      userRepo: this.userRepo,
    });
  }

  /** Get current attendance status for a user. */
  async getCurrentAttendanceStatus(
    userId: string,
    options?: { tenantId?: string },
  ): Promise<CurrentAttendanceStatusResult> {
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

    return this.mapCurrentStatus(attendance, evaluation, timezone);
  }

  private mapCurrentStatus(
    attendance: CurrentAttendanceRow | null,
    evaluation: CurrentAttendanceEvaluationRow,
    timezone: string,
  ): CurrentAttendanceStatusResult {
    if (!attendance) {
      return buildIdleCurrentAttendanceStatus(undefined, null, evaluation);
    }

    const decision = this.sessionPolicyService.resolve({
      attendance,
      now: new Date(),
      scheduleEndTime: null,
    });
    const warningMessage = getCurrentAttendanceWarningMessage(evaluation, null);
    if (decision.isStaleFlexibleSession) {
      return this.mapStaleSession(attendance, evaluation, timezone);
    }

    const sameDay = isSameAttendanceDay(
      attendance.checkIn,
      new Date(),
      timezone,
    );
    const shouldAppearActive =
      decision.isOvernightShiftActive ||
      attendance.user?.workingHourMode === "FLEXIBLE" ||
      sameDay;
    if (!attendance.checkOut && shouldAppearActive) {
      return mapCurrentAttendanceStatusResult({
        attendance,
        evaluation,
        timezone,
        status: "checked-in",
        warningMessage,
      });
    }
    if (attendance.checkOut && sameDay) {
      return mapCurrentAttendanceStatusResult({
        attendance,
        evaluation,
        timezone,
        status: "checked-out",
        warningMessage,
      });
    }
    return buildIdleCurrentAttendanceStatus(
      attendance,
      warningMessage,
      evaluation,
    );
  }

  private mapStaleSession(
    attendance: CurrentAttendanceRow,
    evaluation: CurrentAttendanceEvaluationRow,
    timezone: string,
  ) {
    return buildIdleCurrentAttendanceStatus(
      attendance,
      getCurrentAttendanceWarningMessage(
        evaluation,
        `Sesi fleksibel lama sejak ${formatCurrentAttendanceWarningDate(attendance.checkIn, timezone)} belum checkout.`,
      ),
      evaluation,
    );
  }
}
