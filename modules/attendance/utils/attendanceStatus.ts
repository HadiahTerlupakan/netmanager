import { fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  startOfDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from "date-fns";

const MILLISECONDS_PER_MINUTE = 60 * 1000;

interface AttendanceStatusCalculationParams {
  checkInTime: Date;
  scheduleTime: string;
  timezone: string;
  toleranceMinutes: number;
}

function parseScheduleTime(scheduleTime: string): {
  hour: number;
  minute: number;
} {
  const [hour = 0, minute = 0] = scheduleTime.split(":").map(Number);
  return { hour, minute };
}

function buildScheduleDate(params: {
  checkInTime: Date;
  scheduleTime: string;
  timezone: string;
}): Date {
  const zonedCheckInTime = toZonedTime(params.checkInTime, params.timezone);
  const { hour, minute } = parseScheduleTime(params.scheduleTime);

  return setMilliseconds(
    setSeconds(
      setMinutes(setHours(startOfDay(zonedCheckInTime), hour), minute),
      0,
    ),
    0,
  );
}

/**
 * Calculate attendance punctuality status from schedule and tolerance.
 */
export function calculateAttendanceStatus(
  params: AttendanceStatusCalculationParams,
): "ON_TIME" | "LATE" {
  const zonedScheduleTime = buildScheduleDate(params);
  const scheduleUtcDate = fromZonedTime(zonedScheduleTime, params.timezone);
  const lateThresholdUtc = new Date(
    scheduleUtcDate.getTime() +
      params.toleranceMinutes * MILLISECONDS_PER_MINUTE,
  );

  return params.checkInTime > lateThresholdUtc ? "LATE" : "ON_TIME";
}
