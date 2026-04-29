import { AttendanceStatus, type WorkingHourMode } from "@prisma/client";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { AttendanceSessionPolicyService } from "./AttendanceSessionPolicyService";
import {
  getScheduleEndTimeForPolicy,
  type CachedUserAttendanceSettings,
} from "./attendance-service-helpers";
import type { ActiveAttendanceSessionRow } from "./attendance-current-status-helpers";
import type { CheckInParams } from "./attendance-service.contracts";

export class AttendanceSessionGuardService {
  constructor(private readonly attendanceRepo: AttendanceRepository) {}

  /** Auto-checkout sesi lama sebelum check-in baru dibuat. */
  async processAutoCheckout(
    input: {
      userDetails: CachedUserAttendanceSettings | null;
      effectiveToday: Date;
      checkInTime: Date;
      tenantId?: string;
      timezone: string;
    } & Pick<CheckInParams, "userId">,
  ) {
    const sessionPolicyService = new AttendanceSessionPolicyService();
    const staleSessions = await this.attendanceRepo.findManyStaleSessions({
      userId: input.userId,
      effectiveToday: input.effectiveToday,
      tenantId: input.tenantId,
    });
    if (staleSessions.length === 0) return;
    await Promise.all(
      staleSessions.map((session) =>
        this.closeStaleSession({
          session,
          sessionPolicyService,
          userDetails: input.userDetails,
          policyNow: input.checkInTime,
          timezone: input.timezone,
        }),
      ),
    );
  }

  /** Tolak check-in jika masih ada sesi aktif yang valid. */
  async assertNoActiveSessionConflict(input: {
    userId: string;
    userDetails: CachedUserAttendanceSettings | null;
    checkInTime: Date;
    timezone: string;
    tenantId?: string;
  }) {
    const latestOpenAttendance =
      (await this.attendanceRepo.findFirstOpenSession({
        userId: input.userId,
        tenantId: input.tenantId,
      })) as ActiveAttendanceSessionRow | null;
    if (!latestOpenAttendance) return;
    const sessionPolicyService = new AttendanceSessionPolicyService();
    const decision = sessionPolicyService.resolve({
      attendance: this.buildOpenSessionPolicyAttendance(
        latestOpenAttendance,
        input.userDetails,
      ),
      now: input.checkInTime,
      scheduleEndTime: this.getOpenSessionScheduleEnd(
        latestOpenAttendance,
        input.userDetails,
      ),
      timezone: input.timezone,
    });
    if (decision.isStaleFlexibleSession || !decision.shouldAutoCheckout) {
      throw new Error("DUPLICATE_ENTRY");
    }
  }

  private async closeStaleSession(input: {
    session: {
      id: string;
      checkIn: Date;
      checkOut: Date | null;
      status: string;
      notes: string | null;
    };
    sessionPolicyService: AttendanceSessionPolicyService;
    userDetails: CachedUserAttendanceSettings | null;
    policyNow: Date;
    timezone: string;
  }) {
    const decision = input.sessionPolicyService.resolve({
      attendance: this.buildSessionPolicyAttendance(
        input.session,
        input.userDetails,
      ),
      now: input.policyNow,
      scheduleEndTime: getScheduleEndTimeForPolicy(
        input.userDetails?.workingHourMode,
        input.userDetails,
        input.userDetails?.shift,
      ),
      timezone: input.timezone,
    });
    const updateData = input.sessionPolicyService.buildAutoCheckoutUpdate({
      decision,
      existingNotes: input.session.notes,
    });
    if (updateData)
      await this.attendanceRepo.update(input.session.id, updateData);
  }

  private buildSessionPolicyAttendance(
    session: {
      id: string;
      checkIn: Date;
      checkOut: Date | null;
      status: string;
    },
    userDetails: CachedUserAttendanceSettings | null,
  ) {
    return {
      id: session.id,
      checkIn: session.checkIn,
      checkOut: session.checkOut,
      status: session.status as AttendanceStatus,
      user: {
        workingHourMode: this.toPolicyWorkingHourMode(
          userDetails?.workingHourMode,
        ),
        flexibleTargetHour: null as number | null,
        shift: userDetails?.shift
          ? {
              startTime: userDetails.shift.startTime,
              endTime: userDetails.shift.endTime,
            }
          : null,
      },
    };
  }

  private buildOpenSessionPolicyAttendance(
    attendance: ActiveAttendanceSessionRow,
    userDetails: CachedUserAttendanceSettings | null,
  ) {
    const workingHourMode =
      attendance.user?.workingHourMode ?? userDetails?.workingHourMode ?? null;
    const shift = attendance.user?.shift ?? userDetails?.shift ?? null;
    return {
      id: attendance.id,
      checkIn: attendance.checkIn,
      checkOut: attendance.checkOut,
      status: attendance.status,
      user: {
        workingHourMode: this.toPolicyWorkingHourMode(workingHourMode),
        flexibleTargetHour: attendance.user?.flexibleTargetHour ?? null,
        shift,
      },
    };
  }

  private getOpenSessionScheduleEnd(
    attendance: ActiveAttendanceSessionRow,
    userDetails: CachedUserAttendanceSettings | null,
  ) {
    const workingHourMode =
      attendance.user?.workingHourMode ?? userDetails?.workingHourMode ?? null;
    const shift = attendance.user?.shift ?? userDetails?.shift ?? null;
    return getScheduleEndTimeForPolicy(workingHourMode, userDetails, shift);
  }

  private toPolicyWorkingHourMode(value: unknown): WorkingHourMode | null {
    return value === "FIXED" || value === "SHIFT" || value === "FLEXIBLE"
      ? value
      : null;
  }
}
