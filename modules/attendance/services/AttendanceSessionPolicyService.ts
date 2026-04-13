import type { AttendanceStatus } from "@prisma/client";

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

function buildDefaultCheckout(
  checkIn: Date,
  scheduleEndTime?: string | null,
): Date {
  const checkoutAt = new Date(checkIn);
  const [hours, minutes] = (
    scheduleEndTime ?? `${ATTENDANCE_CONSTANTS.END_OF_DAY_HOUR}:00`
  )
    .split(":")
    .map(Number);

  checkoutAt.setHours(hours, Number.isFinite(minutes) ? minutes : 0, 0, 0);

  if (checkoutAt <= checkIn) {
    checkoutAt.setTime(
      checkIn.getTime() +
        ATTENDANCE_CONSTANTS.DEFAULT_WORK_HOURS * 60 * 60 * 1000,
    );
  }

  if (checkIn > checkoutAt) {
    checkoutAt.setHours(
      ATTENDANCE_CONSTANTS.END_OF_DAY_HOUR,
      ATTENDANCE_CONSTANTS.END_OF_DAY_MINUTE,
      ATTENDANCE_CONSTANTS.END_OF_DAY_SECOND,
      0,
    );
  }

  return checkoutAt;
}

function getOvernightShiftEnd(
  checkIn: Date,
  startTime: string | null,
  endTime: string | null,
): Date | null {
  if (!startTime || !endTime) {
    return null;
  }

  const [startHour] = startTime.split(":").map(Number);
  const [endHour, endMinute = 0] = endTime.split(":").map(Number);

  if (endHour >= startHour) {
    return null;
  }

  const shiftEnd = new Date(checkIn);
  shiftEnd.setDate(shiftEnd.getDate() + 1);
  shiftEnd.setHours(endHour, endMinute, 0, 0);

  return shiftEnd;
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
      const isStale = now > threshold;

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

    const autoCheckoutAt =
      overnightShiftEnd ??
      buildDefaultCheckout(attendance.checkIn, resolvedScheduleEndTime);
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
