import { DEFAULT_TIMEZONE } from "@/lib/constants/timezone-constants";
import {
  getAttendanceRepository,
  getUserLookupService,
} from "./AttendanceAlertDependencies";
import { isInReminderWindow, isWorkDay } from "./AttendanceAlertClock";
import { getTimezone } from "@/lib/utils/get-timezone";
import type { UserSchedule } from "./AttendanceAlertTypes";

const TIMEZONE_BUFFER_HOURS = 14;

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

    const tenantId = user.tenantId ?? "";
    if (!tenantTimezoneCache.has(tenantId)) {
      const tz = await getTimezone(tenantId);
      tenantTimezoneCache.set(tenantId, tz || DEFAULT_TIMEZONE);
    }
    const timezone = tenantTimezoneCache.get(tenantId)!;

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

    const tenantId = (user as { tenantId?: string }).tenantId ?? "";
    if (!tenantTimezoneCache.has(tenantId)) {
      const tz = await getTimezone(tenantId);
      tenantTimezoneCache.set(tenantId, tz || DEFAULT_TIMEZONE);
    }
    const timezone = tenantTimezoneCache.get(tenantId)!;

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
    });
  }

  return results;
}
