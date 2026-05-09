import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import type { AttendanceStatus } from "../types/attendance.enums";
import type { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import type { UserLookupService } from "@/modules/users";
import { startOfDay, setHours, setMinutes, addDays, getHours } from "date-fns";
import { toZonedTime, toDate, format } from "date-fns-tz";

export type AttendanceGeofencePolicy = "STRICT" | "WARN" | "DISABLED";

export type CachedUserAttendanceSettings = {
  startWorkTime: string | null;
  endWorkTime: string | null;
  workingHourMode: string | null;
  attendanceGeofencePolicy: AttendanceGeofencePolicy | null;
  shiftId: string | null;
  shift: { startTime: string; endTime: string } | null;
};

export type AttendancePolicyScheduleContext = {
  endWorkTime: string | null;
  workingHourMode: string | null;
  shift?: {
    startTime: string | null;
    endTime: string | null;
  } | null;
} | null;

export const USER_SCHEDULE_CACHE_TTL_SECONDS = 60;

/** Format jam absensi saat ini sesuai timezone. */
export function formatCurrentAttendanceTime(
  value: Date | null,
  timezone: string,
): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

/** Format tanggal peringatan absensi saat ini sesuai timezone. */
export function formatCurrentAttendanceWarningDate(
  value: Date,
  timezone: string,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(value)
    .replace(",", "");
}

/** Cek apakah dua timestamp berada pada hari absensi yang sama. */
export function isSameAttendanceDay(
  leftDate: Date,
  rightDate: Date,
  timezone: string,
): boolean {
  return (
    leftDate.toLocaleDateString("en-CA", { timeZone: timezone }) ===
    rightDate.toLocaleDateString("en-CA", { timeZone: timezone })
  );
}

/** Normalisasi daftar reason code yang dipersist. */
export function normalizeReasonCodes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/** Normalisasi source refs evaluasi yang dipersist. */
export function normalizeSourceRefs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

/** Ambil jam selesai kerja yang dipakai kebijakan sesi. */
export function getScheduleEndTimeForPolicy(
  workingHourMode: string | null | undefined,
  userDetails: AttendancePolicyScheduleContext,
  shift:
    | { startTime: string | null; endTime: string | null }
    | null
    | undefined,
): string | null {
  if (workingHourMode === "SHIFT") {
    return shift?.endTime ?? userDetails?.endWorkTime ?? null;
  }

  return userDetails?.endWorkTime ?? null;
}

/** Ambil waktu check-in efektif berdasar payload dan timezone tenant. */
export async function resolveCheckInTimeContext(input: {
  offlineTime?: Date;
  timezone?: string;
  tenantId?: string;
  timezoneService: AttendanceTimezoneService;
}): Promise<{
  timezone: string;
  currentTime: Date;
  checkInTime: Date;
  effectiveToday: Date;
}> {
  const timezone = await resolveAttendanceTimezone(input);
  const { now: currentTime } = input.timezoneService.getEffectiveDate(timezone);
  const checkInTime = input.offlineTime || currentTime;
  return buildCheckInTimeContext(timezone, currentTime, checkInTime);
}

function resolveAttendanceTimezone(input: {
  timezone?: string;
  tenantId?: string;
  timezoneService: AttendanceTimezoneService;
}) {
  return input.timezone || input.timezoneService.getTimezone(input.tenantId);
}

function buildCheckInTimeContext(
  timezone: string,
  currentTime: Date,
  checkInTime: Date,
) {
  return {
    timezone,
    currentTime,
    checkInTime,
    effectiveToday: toStartOfDay(checkInTime, timezone),
  };
}

/** Ambil schedule user dari cache lalu fallback ke repository user. */
export async function getCachedUserAttendanceSettings(input: {
  userId: string;
  userRepo: UserLookupService;
}): Promise<CachedUserAttendanceSettings | null> {
  const cacheKey = `user:schedule:${input.userId}`;
  const cachedSchedule = await readScheduleCache(cacheKey);
  if (cachedSchedule) return cachedSchedule;
  return findAndCacheUserAttendanceSettings(input, cacheKey);
}

async function findAndCacheUserAttendanceSettings(
  input: { userId: string; userRepo: UserLookupService },
  cacheKey: string,
) {
  const userDetails = await input.userRepo.findAttendanceSettingsById(
    input.userId,
  );
  if (userDetails) await writeScheduleCache(cacheKey, userDetails);
  return userDetails;
}

/** Hitung warning checkout user fleksibel bila jam kerja belum terpenuhi. */
export function buildFlexibleCheckoutWarning(input: {
  checkIn: Date;
  checkOutTime: Date;
  targetHours: number;
}): string | undefined {
  const durationHours =
    (input.checkOutTime.getTime() - input.checkIn.getTime()) / (1000 * 60 * 60);

  if (durationHours >= input.targetHours) {
    return undefined;
  }

  const workedHours = Math.floor(durationHours);
  const workedMinutes = Math.round((durationHours % 1) * 60);
  const remainingHours = input.targetHours - durationHours;
  const remainingHoursInt = Math.floor(remainingHours);
  const remainingMinutes = Math.round((remainingHours % 1) * 60);

  return `Jam kerja Anda baru ${workedHours} jam ${workedMinutes} menit. Target kerja: ${input.targetHours} jam. Kurang ${remainingHoursInt} jam ${remainingMinutes} menit.`;
}

/** Build warning message untuk FIXED mode checkout sebelum jam pulang. */
export function buildFixedCheckoutWarning(input: {
  checkOutTime: Date;
  scheduleEndTime: string | null | undefined;
  timezone: string;
}): string | undefined {
  if (!input.scheduleEndTime) return undefined;

  // Parse schedule end time (format: "HH:mm")
  const [endHour, endMinute] = input.scheduleEndTime.split(":").map(Number);
  if (isNaN(endHour) || isNaN(endMinute)) return undefined;

  // Build schedule end datetime
  const checkOutDate = toZonedTime(input.checkOutTime, input.timezone);
  let scheduleEnd = startOfDay(checkOutDate);
  scheduleEnd = setHours(scheduleEnd, endHour);
  scheduleEnd = setMinutes(scheduleEnd, endMinute);
  scheduleEnd = toDate(scheduleEnd, { timeZone: input.timezone });

  // Check if checkout is before schedule end
  if (input.checkOutTime >= scheduleEnd) {
    return undefined; // No warning, checkout after schedule end
  }

  // Calculate difference
  const diffMs = scheduleEnd.getTime() - input.checkOutTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const hours = Math.floor(diffHours);
  const minutes = Math.round((diffHours % 1) * 60);

  const checkOutFormatted = format(input.checkOutTime, "HH:mm", {
    timeZone: input.timezone,
  });

  return `Jam pulang Anda: ${input.scheduleEndTime}. Checkout sekarang: ${checkOutFormatted}. Lebih awal ${hours} jam ${minutes} menit.`;
}

/** Build warning message untuk SHIFT mode checkout sebelum shift selesai. */
export function buildShiftCheckoutWarning(input: {
  checkOutTime: Date;
  shiftEndTime: string | null | undefined;
  timezone: string;
}): string | undefined {
  if (!input.shiftEndTime) return undefined;

  // Parse shift end time (format: "HH:mm")
  const [endHour, endMinute] = input.shiftEndTime.split(":").map(Number);
  if (isNaN(endHour) || isNaN(endMinute)) return undefined;

  // Build shift end datetime
  const checkOutDate = toZonedTime(input.checkOutTime, input.timezone);
  let shiftEnd = startOfDay(checkOutDate);
  shiftEnd = setHours(shiftEnd, endHour);
  shiftEnd = setMinutes(shiftEnd, endMinute);
  shiftEnd = toDate(shiftEnd, { timeZone: input.timezone });

  // Handle overnight shift (e.g., 21:00 - 04:00)
  // If shift end hour is small (< 12) and checkout is after noon, shift end is next day
  const checkOutHour = getHours(checkOutDate);
  if (endHour < 12 && checkOutHour >= 12) {
    shiftEnd = addDays(shiftEnd, 1);
  }

  // Check if checkout is before shift end
  if (input.checkOutTime >= shiftEnd) {
    return undefined; // No warning, checkout after shift end
  }

  // Calculate difference
  const diffMs = shiftEnd.getTime() - input.checkOutTime.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const hours = Math.floor(diffHours);
  const minutes = Math.round((diffHours % 1) * 60);

  const checkOutFormatted = format(input.checkOutTime, "HH:mm", {
    timeZone: input.timezone,
  });

  return `Shift Anda selesai: ${input.shiftEndTime}. Checkout sekarang: ${checkOutFormatted}. Lebih awal ${hours} jam ${minutes} menit.`;
}

/** Gabungkan catatan check-in lama dengan catatan checkout baru. */
export function mergeAttendanceNotes(input: {
  existingNotes: string | null;
  checkoutNotes?: string;
}): string | null {
  if (!input.checkoutNotes) {
    return input.existingNotes;
  }

  if (!input.existingNotes) {
    return input.checkoutNotes;
  }

  return `${input.existingNotes}; Checkout Note: ${input.checkoutNotes}`;
}

/** Hitung status check-in berdasarkan jadwal user. */
export async function resolveCheckInStatus(input: {
  checkInTime: Date;
  timezone: string;
  userDetails: CachedUserAttendanceSettings | null;
  timezoneService: AttendanceTimezoneService;
}): Promise<AttendanceStatus> {
  if (input.userDetails?.workingHourMode === "FLEXIBLE") return "ON_TIME";
  const scheduleTime = getCheckInScheduleTime(input.userDetails);
  if (!scheduleTime) return "ON_TIME";
  return input.timezoneService.calculateStatus(
    input.checkInTime,
    scheduleTime,
    input.timezone,
  );
}

function getCheckInScheduleTime(
  userDetails: CachedUserAttendanceSettings | null,
) {
  return userDetails?.workingHourMode === "SHIFT"
    ? userDetails?.shift?.startTime
    : userDetails?.startWorkTime;
}

async function readScheduleCache(
  cacheKey: string,
): Promise<CachedUserAttendanceSettings | null> {
  try {
    const cachedRaw = await redis.get(cacheKey);
    return cachedRaw
      ? (JSON.parse(cachedRaw) as CachedUserAttendanceSettings)
      : null;
  } catch (error) {
    logger.error(
      `Failed to read attendance schedule cache for ${cacheKey}`,
      error instanceof Error ? error : undefined,
    );
    return null;
  }
}

async function writeScheduleCache(
  cacheKey: string,
  userDetails: CachedUserAttendanceSettings,
): Promise<void> {
  try {
    await redis.setex(
      cacheKey,
      USER_SCHEDULE_CACHE_TTL_SECONDS,
      JSON.stringify(userDetails),
    );
  } catch (error) {
    logger.error(
      `Failed to write attendance schedule cache for ${cacheKey}`,
      error instanceof Error ? error : undefined,
    );
  }
}
