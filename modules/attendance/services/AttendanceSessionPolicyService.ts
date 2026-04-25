import type { AttendanceStatus } from "@prisma/client";
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

  const [hours, minutes = 0] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
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

    if (workingHourMode === "FLEXIBLE") {
      const threshold = new Date(
        attendance.checkIn.getTime() + 24 * 60 * 60 * 1000,
      );
      const isStale = now >= threshold;

      return {
        reason: isStale ? "stale-flexible-session" : "same-day-open",
        isOvernightShiftActive: false,
        isStaleFlexibleSession: isStale,
        shouldAutoCheckout: isStale,
        autoCheckoutAt: isStale ? threshold : null,
        nextStatus: isStale ? attendance.status : null,
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
