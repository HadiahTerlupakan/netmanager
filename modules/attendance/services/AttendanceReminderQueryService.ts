import { DEFAULT_TIMEZONE } from "@/lib/constants/timezone-constants";
import {
  getAttendanceRepository,
  getUserLookupService,
} from "./AttendanceAlertDependencies";
import { isInReminderWindow, isWorkDay } from "./AttendanceAlertClock";
import { getTimezone } from "@/lib/utils/get-timezone";
import type { UserSchedule } from "./AttendanceAlertTypes";

const TIMEZONE_BUFFER_HOURS = 14;
/** Jam lokal (HH) untuk 1x reminder harian flexible yang belum absen sama sekali. */
const FLEXIBLE_NO_CHECKIN_HOUR = 12;

function getWideDayWindow(now: Date) {
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  startOfDay.setTime(
    startOfDay.getTime() - TIMEZONE_BUFFER_HOURS * 60 * 60 * 1000,
  );

  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);
  endOfDay.setTime(endOfDay.getTime() + TIMEZONE_BUFFER_HOURS * 60 * 60 * 1000);

  return { startOfDay, endOfDay };
}

async function resolveTenantTimezone(
  tenantId: string,
  cache: Map<string, string>,
): Promise<string> {
  if (!cache.has(tenantId)) {
    const tz = await getTimezone(tenantId);
    cache.set(tenantId, tz || DEFAULT_TIMEZONE);
  }
  return cache.get(tenantId)!;
}

function getLocalHour(now: Date, timezone: string): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    hour12: false,
  }).format(now);
  return Number.parseInt(hourStr, 10);
}

/** Ambil user yang perlu reminder check-in sesuai jadwal masing-masing. */
export async function getUsersNeedingCheckInReminder(
  reminderMinutes: number = 30,
): Promise<UserSchedule[]> {
  const now = new Date();
  const { startOfDay, endOfDay } = getWideDayWindow(now);

  const users =
    await getUserLookupService().findActiveWithPushTokenAndSchedule();
  const checkedInResults = await getAttendanceRepository().findCheckedInUserIds(
    startOfDay,
    endOfDay,
  );
  const checkedInUserIds = new Set(
    checkedInResults.map((attendance) => attendance.userId),
  );

  const tenantTimezoneCache = new Map<string, string>();
  const results: UserSchedule[] = [];

  for (const user of users) {
    if (checkedInUserIds.has(user.id)) continue;
    if (!user.startWorkTime) continue;
    if (user.workingHourMode === "FLEXIBLE") continue;

    const timezone = await resolveTenantTimezone(
      user.tenantId ?? "",
      tenantTimezoneCache,
    );

    if (!isWorkDay(user.workDays, now, timezone)) continue;
    if (
      !isInReminderWindow(
        user.startWorkTime,
        reminderMinutes,
        now,
        30,
        timezone,
      )
    )
      continue;

    results.push({
      userId: user.id,
      userName: user.name,
      startWorkTime: user.startWorkTime,
      endWorkTime: user.endWorkTime || "17:00",
      workDays: user.workDays,
      pushToken: user.pushToken,
      phone: user.phone ?? null,
    });
  }

  return results;
}

/** Ambil user yang perlu reminder check-out sesuai jadwal masing-masing. */
export async function getUsersNeedingCheckOutReminder(
  reminderMinutes: number = 30,
  windowMinutes: number = 30,
): Promise<UserSchedule[]> {
  const now = new Date();
  const { startOfDay, endOfDay } = getWideDayWindow(now);

  const incompleteAttendance =
    await getAttendanceRepository().findIncompleteCheckOutWithUser(
      startOfDay,
      endOfDay,
    );

  const tenantTimezoneCache = new Map<string, string>();
  const results: UserSchedule[] = [];

  for (const attendance of incompleteAttendance) {
    const user = attendance.user;
    if (!user.endWorkTime) continue;

    const timezone = await resolveTenantTimezone(
      (user as { tenantId?: string }).tenantId ?? "",
      tenantTimezoneCache,
    );

    if (!isWorkDay(user.workDays, now, timezone)) continue;
    if (
      !isInReminderWindow(
        user.endWorkTime,
        reminderMinutes,
        now,
        windowMinutes,
        timezone,
      )
    )
      continue;

    results.push({
      userId: user.id,
      userName: user.name,
      startWorkTime: user.startWorkTime || "08:00",
      endWorkTime: user.endWorkTime,
      workDays: user.workDays,
      pushToken: user.pushToken,
      phone: (user as { phone?: string | null }).phone ?? null,
    });
  }

  return results;
}

/**
 * Flexible yang belum check-in sama sekali di hari kerja.
 * Window: jam lokal >= FLEXIBLE_NO_CHECKIN_HOUR (default 12:00), 1x/hari via lock.
 */
export async function getFlexibleUsersNeedingNoCheckInReminder(): Promise<
  UserSchedule[]
> {
  const now = new Date();
  const { startOfDay, endOfDay } = getWideDayWindow(now);

  const users = await getUserLookupService().findActiveFlexibleWithContact();
  const checkedInResults = await getAttendanceRepository().findCheckedInUserIds(
    startOfDay,
    endOfDay,
  );
  const checkedInUserIds = new Set(
    checkedInResults.map((attendance) => attendance.userId),
  );

  const tenantTimezoneCache = new Map<string, string>();
  const results: UserSchedule[] = [];

  for (const user of users) {
    if (checkedInUserIds.has(user.id)) continue;

    const timezone = await resolveTenantTimezone(
      user.tenantId ?? "",
      tenantTimezoneCache,
    );
    if (!isWorkDay(user.workDays, now, timezone)) continue;
    if (getLocalHour(now, timezone) < FLEXIBLE_NO_CHECKIN_HOUR) continue;

    results.push({
      userId: user.id,
      userName: user.name,
      startWorkTime: "fleksibel",
      endWorkTime: "fleksibel",
      workDays: user.workDays,
      pushToken: user.pushToken,
      phone: user.phone ?? null,
    });
  }

  return results;
}
