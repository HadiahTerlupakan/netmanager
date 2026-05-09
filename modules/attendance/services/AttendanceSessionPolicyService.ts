import type { AttendanceStatus } from "../types/attendance.enums";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { ATTENDANCE_CONSTANTS } from "../utils/constants";

type WorkingHourMode = "FIXED" | "SHIFT" | "FLEXIBLE" | null;

export type AttendanceSessionPolicyInput = {
  attendance: {
    id: string;
    checkIn: Date;
    checkOut: Date | null;
    status: AttendanceStatus;
    user: {
      workingHourMode: WorkingHourMode;
      flexibleTargetHour: number | null;
      shift: {
        startTime: string | null;
        endTime: string | null;
      } | null;
    } | null;
  };
  now: Date;
  scheduleEndTime?: string | null;
  timezone?: string;
};

export type AttendanceSessionPolicyDecision = {
  reason:
    | "already-closed"
    | "same-day-open"
    | "overnight-shift-active"
    | "stale-flexible-session"
    | "eligible-for-auto-checkout";
  isOvernightShiftActive: boolean;
  isStaleFlexibleSession: boolean;
  shouldAutoCheckout: boolean;
  autoCheckoutAt: Date | null;
  nextStatus: AttendanceStatus | null;
};

export type AttendanceAutoCheckoutUpdate = {
  checkOut: Date;
  notes: string;
  status: AttendanceStatus;
};

function parseTimeParts(time: string | null | undefined): {
  hours: number;
  minutes: number;
} | null {
  if (!time) {
    return null;
  }

  // Validate time format: HH:mm or H:mm
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(time)) {
    throw new Error(
      `Invalid time format: "${time}". Expected HH:mm (e.g., "08:30", "17:00")`,
    );
  }

  const [hours, minutes = 0] = time.split(":").map(Number);

  // Additional validation (redundant but safe)
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(
      `Invalid time values: ${hours}:${minutes}. Hours must be 0-23, minutes 0-59`,
    );
  }

  return { hours, minutes };
}

function getTotalMinutes(time: string | null | undefined): number | null {
  const parts = parseTimeParts(time);
  if (!parts) {
    return null;
  }

  return parts.hours * 60 + parts.minutes;
}

function buildTenantLocalDateTime(params: {
  anchor: Date;
  time: string;
  timezone: string;
  addDays?: number;
}): Date {
  const { anchor, time, timezone, addDays = 0 } = params;
  const parts = parseTimeParts(time);
  const localAnchor = toZonedTime(anchor, timezone);

  if (!parts) {
    return new Date(anchor);
  }

  localAnchor.setDate(localAnchor.getDate() + addDays);
  localAnchor.setHours(parts.hours, parts.minutes, 0, 0);

  return fromZonedTime(localAnchor, timezone);
}

function buildDefaultCheckout(
  checkIn: Date,
  scheduleEndTime: string | null | undefined,
  timezone: string,
): Date {
  const checkoutAt = buildTenantLocalDateTime({
    anchor: checkIn,
    time: scheduleEndTime ?? `${ATTENDANCE_CONSTANTS.END_OF_DAY_HOUR}:00`,
    timezone,
  });

  if (checkoutAt <= checkIn) {
    return new Date(
      checkIn.getTime() +
        ATTENDANCE_CONSTANTS.DEFAULT_WORK_HOURS * 60 * 60 * 1000,
    );
  }

  return checkoutAt;
}

function addAutoCheckoutGracePeriod(checkoutAt: Date): Date {
  return new Date(
    checkoutAt.getTime() +
      ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_GRACE_HOURS * 60 * 60 * 1000,
  );
}

function getOvernightShiftEnd(
  checkIn: Date,
  startTime: string | null,
  endTime: string | null,
  timezone: string,
): Date | null {
  const startMinutes = getTotalMinutes(startTime);
  const endMinutes = getTotalMinutes(endTime);

  if (startMinutes === null || endMinutes === null) {
    return null;
  }

  if (endMinutes >= startMinutes) {
    return null;
  }

  return buildTenantLocalDateTime({
    anchor: checkIn,
    time: endTime!,
    timezone,
    addDays: 1,
  });
}

export class AttendanceSessionPolicyService {
  buildAutoCheckoutUpdate(params: {
    decision: AttendanceSessionPolicyDecision;
    existingNotes: string | null;
  }): AttendanceAutoCheckoutUpdate | null {
    const { decision, existingNotes } = params;

    if (
      !decision.shouldAutoCheckout ||
      !decision.autoCheckoutAt ||
      !decision.nextStatus
    ) {
      return null;
    }

    const notes = existingNotes
      ? `${existingNotes} ${ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE}`
      : ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE;

    return {
      checkOut: decision.autoCheckoutAt,
      notes,
      status: decision.nextStatus,
    };
  }

  resolve(
    input: AttendanceSessionPolicyInput,
  ): AttendanceSessionPolicyDecision {
    const { attendance, now, scheduleEndTime } = input;
    const timezone = input.timezone ?? process.env.TZ ?? "Asia/Jakarta";

    if (attendance.checkOut) {
      return {
        reason: "already-closed",
        isOvernightShiftActive: false,
        isStaleFlexibleSession: false,
        shouldAutoCheckout: false,
        autoCheckoutAt: null,
        nextStatus: null,
      };
    }

    const workingHourMode = attendance.user?.workingHourMode ?? null;

    if (workingHourMode === "SHIFT") {
      if (
        !attendance.user?.shift?.startTime ||
        !attendance.user?.shift?.endTime
      ) {
        throw new Error("Shift data required for SHIFT mode");
      }
    }

    if (workingHourMode === "FIXED" && !scheduleEndTime) {
      throw new Error("Schedule end time required for FIXED mode");
    }

    if (workingHourMode === "FLEXIBLE") {
      const targetHours = attendance.user?.flexibleTargetHour ?? 8;
      const gracePeriodHours = ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_GRACE_HOURS;
      const threshold = new Date(
        attendance.checkIn.getTime() +
          (targetHours + gracePeriodHours) * 60 * 60 * 1000,
      );
      const isStale = now >= threshold;

      return {
        reason: isStale ? "stale-flexible-session" : "same-day-open",
        isOvernightShiftActive: false,
        isStaleFlexibleSession: isStale,
        shouldAutoCheckout: isStale,
        autoCheckoutAt: isStale ? threshold : null,
        nextStatus: isStale ? "NO_CHECKOUT" : null,
      };
    }

    const overnightShiftEnd = getOvernightShiftEnd(
      attendance.checkIn,
      attendance.user?.shift?.startTime ?? null,
      attendance.user?.shift?.endTime ?? null,
      timezone,
    );

    if (overnightShiftEnd && now < overnightShiftEnd) {
      return {
        reason: "overnight-shift-active",
        isOvernightShiftActive: true,
        isStaleFlexibleSession: false,
        shouldAutoCheckout: false,
        autoCheckoutAt: null,
        nextStatus: null,
      };
    }

    const resolvedScheduleEndTime =
      workingHourMode === "SHIFT"
        ? (attendance.user?.shift?.endTime ?? scheduleEndTime)
        : scheduleEndTime;

    const scheduleCheckoutAt =
      overnightShiftEnd ??
      buildDefaultCheckout(
        attendance.checkIn,
        resolvedScheduleEndTime,
        timezone,
      );
    const autoCheckoutAt = addAutoCheckoutGracePeriod(scheduleCheckoutAt);
    const shouldAutoCheckout = now >= autoCheckoutAt;

    return {
      reason: shouldAutoCheckout
        ? "eligible-for-auto-checkout"
        : "same-day-open",
      isOvernightShiftActive: false,
      isStaleFlexibleSession: false,
      shouldAutoCheckout,
      autoCheckoutAt: shouldAutoCheckout ? autoCheckoutAt : null,
      nextStatus: shouldAutoCheckout ? "NO_CHECKOUT" : null,
    };
  }
}
