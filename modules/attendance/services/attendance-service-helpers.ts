import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import type { AttendanceStatus } from "@prisma/client";
import type { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import type { UserLookupService } from "@/modules/users";

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
  const timezone =
    input.timezone || (await input.timezoneService.getTimezone(input.tenantId));
  const { now: currentTime } = input.timezoneService.getEffectiveDate(timezone);
  const checkInTime = input.offlineTime || currentTime;

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
  if (cachedSchedule) {
    return cachedSchedule;
  }

  const userDetails = await input.userRepo.findAttendanceSettingsById(
    input.userId,
  );

  if (userDetails) {
    await writeScheduleCache(cacheKey, userDetails);
  }

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
  if (input.userDetails?.workingHourMode === "FLEXIBLE") {
    return "ON_TIME";
  }

  const scheduleTime =
    input.userDetails?.workingHourMode === "SHIFT"
      ? input.userDetails.shift?.startTime
      : input.userDetails?.startWorkTime;

  if (!scheduleTime) {
    return "ON_TIME";
  }

  return input.timezoneService.calculateStatus(
    input.checkInTime,
    scheduleTime,
    input.timezone,
  );
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
