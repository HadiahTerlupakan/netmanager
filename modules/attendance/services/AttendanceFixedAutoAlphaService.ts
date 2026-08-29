import { logger } from "@/lib/logger";
import { getTimezone } from "@/lib/utils/get-timezone";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { randomUUID } from "crypto";
import {
  getDateKeyInTimezone,
  isWorkDay,
  parseTimeToDateInTimezone,
} from "./AttendanceAlertClock";
import {
  getAttendanceRepository,
  getHolidayRepository,
  getLeaveRepository,
  getUserLookupService,
} from "./AttendanceAlertDependencies";
import { acquireReminderLock } from "./AttendanceAlertLockService";
import type { FixedAlphaResult } from "./AttendanceAlertTypes";

/** Auto-mark ABSENT untuk user fixed-hour setelah jam kerja selesai tanpa check-in. */
export async function processFixedHourAutoAlpha(): Promise<FixedAlphaResult> {
  try {
    const context = await loadAutoAlphaContext();
    await processAutoAlphaUsers(context);
    logAutoAlphaResult(context.usersMarkedAlpha);
    return buildAutoAlphaResult(context);
  } catch (error) {
    logger.error(
      "[AttendanceAlert] Error auto-marking fixed-hour ABSENT:",
      error,
    );
    return { usersMarkedAlpha: 0, details: [] };
  }
}

async function processAutoAlphaUsers(context: AutoAlphaContext) {
  for (const user of context.users) {
    if (!(await canCreateAutoAlpha(user, context))) continue;
    await createAutoAlphaAttendance(user, context);
    context.usersMarkedAlpha++;
    context.details.push(`${user.name || user.id} (${user.endWorkTime})`);
  }
}

function logAutoAlphaResult(usersMarkedAlpha: number) {
  if (usersMarkedAlpha === 0) return;
  logger.info(
    `[AttendanceAlert] Auto-marked ABSENT for ${usersMarkedAlpha} fixed-hour users`,
  );
}

function buildAutoAlphaResult(context: AutoAlphaContext): FixedAlphaResult {
  return {
    usersMarkedAlpha: context.usersMarkedAlpha,
    details: context.details,
  };
}

type AutoAlphaUser = Awaited<
  ReturnType<
    ReturnType<typeof getUserLookupService>["findFixedHourUsersForAutoAlpha"]
  >
>[number];

interface AutoAlphaContext {
  now: Date;
  timezoneCache: Map<string, string>;
  users: AutoAlphaUser[];
  details: string[];
  usersMarkedAlpha: number;
}

async function loadAutoAlphaContext(): Promise<AutoAlphaContext> {
  const now = new Date();
  const firstTimezone = await getTimezone();
  const todayStart = toStartOfDay(
    getDateKeyInTimezone(now, firstTimezone),
    firstTimezone,
  );
  const users =
    await getUserLookupService().findFixedHourUsersForAutoAlpha(todayStart);
  return {
    now,
    timezoneCache: new Map<string, string>(),
    users,
    details: [],
    usersMarkedAlpha: 0,
  };
}

async function canCreateAutoAlpha(
  user: AutoAlphaUser,
  context: AutoAlphaContext,
) {
  if (user.workingHourMode !== "FIXED") return false;
  if (!user.isAttendanceRequired) return false;
  if (!user.tenantId || !user.endWorkTime) return false;

  const timezone = await resolveTenantTimezone(
    user.tenantId,
    context.timezoneCache,
  );
  const currentDateKey = getDateKeyInTimezone(context.now, timezone);
  const startOfDay = toStartOfDay(currentDateKey, timezone);
  const endOfDay = toEndOfDay(currentDateKey, timezone);

  if (user.joinDate && new Date(user.joinDate) > startOfDay) return false;
  if (!isWorkDay(user.workDays, context.now, timezone)) return false;
  if (
    context.now <
    parseTimeToDateInTimezone(user.endWorkTime, context.now, timezone)
  )
    return false;
  if (await hasHoliday(user.tenantId, startOfDay, endOfDay)) return false;
  if (await hasAttendance(user.id, user.tenantId, startOfDay, endOfDay))
    return false;
  if (await hasApprovedLeave(user.id, user.tenantId, startOfDay, endOfDay))
    return false;

  const lockKey = `attendance:auto-alpha:${user.id}:${currentDateKey}`;
  return acquireReminderLock(lockKey, 15 * 60);
}

async function createAutoAlphaAttendance(
  user: AutoAlphaUser,
  context: AutoAlphaContext,
) {
  const timezone = await resolveTenantTimezone(
    user.tenantId!,
    context.timezoneCache,
  );
  const currentDateKey = getDateKeyInTimezone(context.now, timezone);
  const startOfDay = toStartOfDay(currentDateKey, timezone);
  await getAttendanceRepository().createWithId({
    id: randomUUID(),
    userId: user.id,
    tenantId: user.tenantId!,
    checkIn: new Date(startOfDay),
    checkInDate: new Date(startOfDay),
    status: "ABSENT",
    notes: "Tidak Masuk Kerja (Absent) - Auto Generated",
    location: "System",
    updatedAt: new Date(),
  });
}

async function resolveTenantTimezone(
  tenantId: string,
  timezoneCache: Map<string, string>,
) {
  let timezone = timezoneCache.get(tenantId);
  if (!timezone) {
    timezone = await getTimezone(tenantId);
    timezoneCache.set(tenantId, timezone);
  }
  return timezone;
}

async function hasHoliday(tenantId: string, startOfDay: Date, endOfDay: Date) {
  return Boolean(
    await getHolidayRepository().findFirstByTenantAndDateRange(
      tenantId,
      startOfDay,
      endOfDay,
    ),
  );
}

async function hasAttendance(
  userId: string,
  tenantId: string,
  startOfDay: Date,
  endOfDay: Date,
) {
  return Boolean(
    await getAttendanceRepository().findFirstByUserAndDateRange(
      userId,
      tenantId,
      startOfDay,
      endOfDay,
    ),
  );
}

async function hasApprovedLeave(
  userId: string,
  tenantId: string,
  startOfDay: Date,
  endOfDay: Date,
) {
  return Boolean(
    await getLeaveRepository().findActiveLeaveForUserOnDate(
      userId,
      startOfDay,
      endOfDay,
      tenantId,
    ),
  );
}
