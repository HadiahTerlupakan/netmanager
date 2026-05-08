import {
  addDays,
  isAfter,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  startOfDay as fnsStartOfDay,
  subHours,
} from "date-fns";
import { toDate, toZonedTime } from "date-fns-tz";

export const CHECK_IN_WINDOW_HOURS = 3;

export interface AttendanceSchedule {
  startTime: string;
  endTime: string;
}

export interface ScheduleWindow {
  startAt: Date;
  endAt: Date;
  windowStart: Date;
}

/** Build timezone-aware clock time dari work date dan time string (HH:mm). */
export function buildClockTime(
  workDate: Date,
  time: string,
  timezone: string,
): Date {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const zonedDate = toZonedTime(workDate, timezone);
  let candidate = fnsStartOfDay(zonedDate);

  candidate = setHours(candidate, hour);
  candidate = setMinutes(candidate, minute);
  candidate = setSeconds(candidate, 0);
  candidate = setMilliseconds(candidate, 0);

  return toDate(candidate, { timeZone: timezone });
}

/** Build schedule window dengan 3 jam buffer sebelum jam kerja. */
export function buildScheduleWindow(
  workDate: Date,
  schedule: AttendanceSchedule,
  timezone: string,
): ScheduleWindow {
  const startAt = buildClockTime(workDate, schedule.startTime, timezone);
  let endAt = buildClockTime(workDate, schedule.endTime, timezone);

  // Handle overnight shifts (e.g., 22:00-06:00)
  if (!isAfter(endAt, startAt)) {
    endAt = addDays(endAt, 1);
  }

  return {
    startAt,
    endAt,
    windowStart: subHours(startAt, CHECK_IN_WINDOW_HOURS),
  };
}

/** Parse time string (HH:mm) dengan validasi format. */
export function parseTime(value: string | null | undefined): string | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  return value;
}
