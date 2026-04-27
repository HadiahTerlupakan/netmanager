import { redis } from "@/lib/redis";
import {
  sendPushNotification,
  createNotification,
} from "@/modules/notification";
import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";
import { randomUUID } from "crypto";
import { getTimezone } from "@/lib/utils/get-timezone";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { LeaveRepository } from "../repositories/LeaveRepository";
import { HolidayRepository } from "../repositories/HolidayRepository";
import { UserRepository } from "@/modules/users";

const attendanceRepo = new AttendanceRepository();
const leaveRepo = new LeaveRepository();
const holidayRepo = new HolidayRepository();
const userRepository = new UserRepository();

/**
 * Attendance Alert Service
 * Handles notifications for missing/incomplete attendance
 * Uses per-user work schedule settings (startWorkTime, endWorkTime)
 */

interface UserSchedule {
  userId: string;
  userName: string | null;
  startWorkTime: string;
  endWorkTime: string;
  workDays: string | null;
  pushToken: string | null;
}

function getDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function getDateKeyInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getFlexibleHourBucket(excessHours: number): number {
  return Math.floor(excessHours);
}

async function acquireReminderLock(
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  try {
    const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[AttendanceAlert] Reminder lock unavailable for "${key}": ${message}`,
    );
    return false;
  }
}

/**
 * Parse time string (HH:mm) to Date object for today
 */
function parseTimeToDate(timeStr: string, date: Date = new Date()): Date {
  const parts = timeStr.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function parseTimeToDateInTimezone(
  timeStr: string,
  date: Date,
  timezone: string,
): Date {
  const parts = timeStr.split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const startOfLocalDay = toStartOfDay(
    getDateKeyInTimezone(date, timezone),
    timezone,
  );
  return new Date(
    startOfLocalDay.getTime() + hours * 60 * 60 * 1000 + minutes * 60 * 1000,
  );
}

/**
 * Check if current time is past the reminder time
 * @param workTime - Work start/end time (HH:mm)
 * @param reminderMinutes - Minutes after workTime to trigger reminder
 * @param currentTime - Current time
 * @param windowMinutes - How long the reminder window stays open (default 30 min)
 */
function isInReminderWindow(
  workTime: string,
  reminderMinutes: number = 30,
  currentTime: Date = new Date(),
  windowMinutes: number = 30,
): boolean {
  const workDate = parseTimeToDate(workTime, currentTime);
  const reminderStart = new Date(
    workDate.getTime() + reminderMinutes * 60 * 1000,
  );
  const reminderEnd = new Date(
    reminderStart.getTime() + windowMinutes * 60 * 1000,
  );

  return currentTime >= reminderStart && currentTime <= reminderEnd;
}

/**
 * Get day name in English (MON, TUE, WED, etc.)
 */
function getDayName(date: Date = new Date(), timezone?: string): string {
  if (timezone) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
    })
      .format(date)
      .slice(0, 3)
      .toUpperCase();
  }

  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return days[date.getDay()] ?? "SUN";
}

/**
 * Check if user works on given day
 */
function isWorkDay(
  workDays: string | null,
  date: Date = new Date(),
  timezone?: string,
): boolean {
  if (!workDays) return true;

  const dayName = getDayName(date, timezone);
  const workDayList = workDays
    .toUpperCase()
    .split(",")
    .map((d) => d.trim());

  return workDayList.includes(dayName);
}

/**
 * Get users who need check-in reminder based on their individual schedules
 */
export async function getUsersNeedingCheckInReminder(
  reminderMinutes: number = 30,
): Promise<UserSchedule[]> {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setTime(toStartOfDay(startOfDay).getTime());
  const endOfDay = new Date(now);
  endOfDay.setTime(toEndOfDay(endOfDay).getTime());

  const users = await userRepository.findActiveWithPushTokenAndSchedule();

  const checkedInResults = await attendanceRepo.findCheckedInUserIds(
    startOfDay,
    endOfDay,
  );
  const checkedInUserIds = new Set(checkedInResults.map((a) => a.userId));

  return users
    .filter((user) => {
      if (checkedInUserIds.has(user.id)) return false;
      if (!user.startWorkTime) return false;
      if (!isWorkDay(user.workDays, now)) return false;
      if (!isInReminderWindow(user.startWorkTime, reminderMinutes, now))
        return false;

      return true;
    })
    .map((user) => ({
      userId: user.id,
      userName: user.name,
      startWorkTime: user.startWorkTime!,
      endWorkTime: user.endWorkTime || "17:00",
      workDays: user.workDays,
      pushToken: user.pushToken,
    }));
}

/**
 * Get users who need check-out reminder based on their individual schedules
 */
export async function getUsersNeedingCheckOutReminder(
  reminderMinutes: number = 30,
  windowMinutes: number = 30,
): Promise<UserSchedule[]> {
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setTime(toStartOfDay(startOfDay).getTime());
  const endOfDay = new Date(now);
  endOfDay.setTime(toEndOfDay(endOfDay).getTime());

  const incompleteAttendance =
    await attendanceRepo.findIncompleteCheckOutWithUser(startOfDay, endOfDay);

  return incompleteAttendance
    .filter((att) => {
      const user = att.user;
      if (!user.endWorkTime) return false;
      if (!isWorkDay(user.workDays, now)) return false;
      if (
        !isInReminderWindow(
          user.endWorkTime,
          reminderMinutes,
          now,
          windowMinutes,
        )
      )
        return false;

      return true;
    })
    .map((att) => ({
      userId: att.user.id,
      userName: att.user.name,
      startWorkTime: att.user.startWorkTime || "08:00",
      endWorkTime: att.user.endWorkTime!,
      workDays: att.user.workDays,
      pushToken: att.user.pushToken,
    }));
}

/**
 * Send check-in reminders to users based on their schedules
 */
export async function processCheckInReminders(
  reminderMinutes: number = 30,
): Promise<{ usersNotified: number; details: string[] }> {
  try {
    const users = await getUsersNeedingCheckInReminder(reminderMinutes);

    if (users.length === 0) {
      console.log(
        "[AttendanceAlert] No users need check-in reminder at this time",
      );
      return { usersNotified: 0, details: [] };
    }

    const details: string[] = [];
    let notified = 0;

    for (const user of users) {
      if (user.pushToken) {
        const reminderKey = `attendance:reminder:checkin:${user.userId}:${getDateKey()}`;
        const shouldSend = await acquireReminderLock(reminderKey, 60 * 60);
        if (!shouldSend) {
          continue;
        }

        await sendPushNotification(
          user.userId,
          "⏰ Reminder Absensi",
          `Anda belum check-in hari ini. Jam kerja Anda: ${user.startWorkTime}`,
          {
            type: "attendance_reminder",
            action: "check_in",
          },
        );
        notified++;
        details.push(`${user.userName} (${user.startWorkTime})`);
      }
    }

    console.log(
      `[AttendanceAlert] Sent check-in reminder to ${notified} users`,
    );
    return { usersNotified: notified, details };
  } catch (error) {
    console.error("[AttendanceAlert] Error sending check-in reminders:", error);
    return { usersNotified: 0, details: [] };
  }
}

/**
 * Send check-out reminders to users based on their schedules
 */
export async function processCheckOutReminders(
  reminderMinutes: number = 30,
): Promise<{ usersNotified: number; details: string[] }> {
  try {
    const users = await getUsersNeedingCheckOutReminder(reminderMinutes);

    if (users.length === 0) {
      console.log(
        "[AttendanceAlert] No users need check-out reminder at this time",
      );
      return { usersNotified: 0, details: [] };
    }

    const details: string[] = [];
    let notified = 0;

    for (const user of users) {
      if (user.pushToken) {
        const reminderKey = `attendance:reminder:checkout:${user.userId}:${getDateKey()}`;
        const shouldSend = await acquireReminderLock(reminderKey, 60 * 60);
        if (!shouldSend) {
          continue;
        }

        await sendPushNotification(
          user.userId,
          "🏠 Reminder Check-Out",
          `Anda belum check-out hari ini. Jam pulang Anda: ${user.endWorkTime}`,
          {
            type: "attendance_reminder",
            action: "check_out",
          },
        );
        notified++;
        details.push(`${user.userName} (${user.endWorkTime})`);
      }
    }

    console.log(
      `[AttendanceAlert] Sent check-out reminder to ${notified} users`,
    );
    return { usersNotified: notified, details };
  } catch (error) {
    console.error(
      "[AttendanceAlert] Error sending check-out reminders:",
      error,
    );
    return { usersNotified: 0, details: [] };
  }
}

/**
 * Send individual attendance alert to a specific user
 */
export async function sendAttendanceAlertToUser(
  userId: string,
  type: "missing_checkin" | "missing_checkout" | "late",
): Promise<boolean> {
  const messages = {
    missing_checkin: {
      title: "⚠️ Absensi Tidak Lengkap",
      body: "Anda belum melakukan check-in hari ini.",
    },
    missing_checkout: {
      title: "⚠️ Absensi Tidak Lengkap",
      body: "Anda belum melakukan check-out hari ini.",
    },
    late: {
      title: "⏰ Keterlambatan Terdeteksi",
      body: "Anda tercatat terlambat masuk hari ini.",
    },
  };

  const message = messages[type];

  await createNotification({
    type: "ALERT",
    priority: "NORMAL",
    title: message.title,
    message: message.body,
    userId,
    sourceType: "ATTENDANCE",
    link: "/attendance",
  });

  return true;
}

/**
 * Process incomplete attendance for end of day reporting
 */
export async function processIncompleteAttendance(): Promise<{
  missingCheckOut: number;
  usersNotified: string[];
}> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setTime(toStartOfDay(startOfDay).getTime());
  const endOfDay = new Date(now);
  endOfDay.setTime(toEndOfDay(endOfDay).getTime());

  const incomplete = await attendanceRepo.findIncompleteCheckOutSelect(
    startOfDay,
    endOfDay,
  );

  const usersNotified: string[] = [];

  for (const att of incomplete) {
    const reminderKey = `attendance:alert:missing_checkout:${att.userId}:${getDateKey()}`;
    const shouldSend = await acquireReminderLock(reminderKey, 12 * 60 * 60);
    if (!shouldSend) {
      continue;
    }

    await sendAttendanceAlertToUser(att.userId, "missing_checkout");
    usersNotified.push(att.user.name || att.userId);
  }

  return {
    missingCheckOut: incomplete.length,
    usersNotified,
  };
}

export async function processFixedHourAutoAlpha(): Promise<{
  usersMarkedAlpha: number;
  details: string[];
}> {
  try {
    const now = new Date();
    const timezoneCache = new Map<string, string>();
    const details: string[] = [];
    let usersMarkedAlpha = 0;

    const firstTimezone = await getTimezone();
    const todayStart = toStartOfDay(
      getDateKeyInTimezone(now, firstTimezone),
      firstTimezone,
    );
    const users =
      await userRepository.findFixedHourUsersForAutoAlpha(todayStart);

    if (users.length === 0) {
      return { usersMarkedAlpha: 0, details: [] };
    }

    for (const user of users) {
      if (user.workingHourMode !== "FIXED") continue;
      if (!user.isAttendanceRequired) continue;
      if (!user.tenantId || !user.endWorkTime) continue;

      let timezone = timezoneCache.get(user.tenantId);
      if (!timezone) {
        timezone = await getTimezone(user.tenantId);
        timezoneCache.set(user.tenantId, timezone);
      }

      const currentDateKey = getDateKeyInTimezone(now, timezone);
      const startOfDay = toStartOfDay(currentDateKey, timezone);
      const endOfDay = toEndOfDay(currentDateKey, timezone);

      if (user.joinDate && new Date(user.joinDate) > startOfDay) continue;
      if (!isWorkDay(user.workDays, now, timezone)) continue;

      const shiftEndTime = parseTimeToDateInTimezone(
        user.endWorkTime,
        now,
        timezone,
      );
      if (now < shiftEndTime) continue;

      const holiday = await holidayRepo.findFirstByTenantAndDateRange(
        user.tenantId,
        startOfDay,
        endOfDay,
      );

      if (holiday) continue;

      const existingAttendance =
        await attendanceRepo.findFirstByUserAndDateRange(
          user.id,
          user.tenantId,
          startOfDay,
          endOfDay,
        );

      if (existingAttendance) continue;

      const approvedLeave = await leaveRepo.findActiveLeaveForUserOnDate(
        user.id,
        startOfDay,
        endOfDay,
        user.tenantId,
      );

      if (approvedLeave) continue;

      const alphaLockKey = `attendance:auto-alpha:${user.id}:${currentDateKey}`;
      const shouldCreate = await acquireReminderLock(alphaLockKey, 15 * 60);
      if (!shouldCreate) continue;

      const alphaTime = new Date(startOfDay);

      await attendanceRepo.createWithId({
        id: randomUUID(),
        userId: user.id,
        tenantId: user.tenantId,
        checkIn: alphaTime,
        status: "ABSENT",
        notes: "Tidak Masuk Kerja (Absent) - Auto Generated",
        location: "System",
        updatedAt: new Date(),
      });

      usersMarkedAlpha++;
      details.push(`${user.name || user.id} (${user.endWorkTime})`);
    }

    if (usersMarkedAlpha > 0) {
      console.log(
        `[AttendanceAlert] Auto-marked ABSENT for ${usersMarkedAlpha} fixed-hour users`,
      );
    }

    return { usersMarkedAlpha, details };
  } catch (error) {
    console.error(
      "[AttendanceAlert] Error auto-marking fixed-hour ABSENT:",
      error,
    );
    return { usersMarkedAlpha: 0, details: [] };
  }
}

// New Function: Late Checkout Reminder (3-4 hours after shift)
export async function processLateCheckOutReminders(): Promise<{
  usersNotified: number;
  details: string[];
}> {
  const reminderMinutes = 180;
  const windowMinutes = 60;

  try {
    const users = await getUsersNeedingCheckOutReminder(
      reminderMinutes,
      windowMinutes,
    );

    if (users.length === 0) {
      return { usersNotified: 0, details: [] };
    }

    const details: string[] = [];
    let notified = 0;

    for (const user of users) {
      if (user.pushToken) {
        const reminderKey = `attendance:reminder:late_checkout:${user.userId}:${getDateKey()}`;
        const shouldSend = await acquireReminderLock(reminderKey, 2 * 60 * 60);
        if (!shouldSend) {
          continue;
        }

        await sendPushNotification(
          user.userId,
          "🛑 Belum Absen Pulang?",
          `Sudah 3 jam lewat dari jam pulang (${user.endWorkTime}). Jangan lupa Check-Out agar tidak kena penalti!`,
          {
            type: "attendance_reminder",
            action: "check_out",
          },
        );
        notified++;
        details.push(`${user.userName} (${user.endWorkTime})`);
      }
    }

    console.log(
      `[AttendanceAlert] Sent LATE check-out reminder to ${notified} users`,
    );
    return { usersNotified: notified, details };
  } catch (error) {
    console.error(
      "[AttendanceAlert] Error sending late check-out reminders:",
      error,
    );
    return { usersNotified: 0, details: [] };
  }
}

/**
 * Main function to be called by cron job every 15 minutes
 * Automatically checks all users based on their individual schedules
 */
export async function runScheduledAttendanceCheck(
  reminderMinutes: number = 30,
): Promise<{
  checkIn: { usersNotified: number; details: string[] };
  checkOut: { usersNotified: number; details: string[] };
  lateCheckOut: { usersNotified: number; details: string[] };
  fixedAlpha: { usersMarkedAlpha: number; details: string[] };
  flexible: { usersNotified: number; details: string[] };
}> {
  const [
    checkInResult,
    checkOutResult,
    lateCheckOutResult,
    fixedAlphaResult,
    flexibleReminderResult,
  ] = await Promise.all([
    processCheckInReminders(reminderMinutes),
    processCheckOutReminders(reminderMinutes),
    processLateCheckOutReminders(),
    processFixedHourAutoAlpha(),
    processFlexibleReminders(),
  ]);

  console.log("[AttendanceAlert] Scheduled check completed:", {
    checkIn: checkInResult.usersNotified,
    checkOut: checkOutResult.usersNotified,
    lateCheckOut: lateCheckOutResult.usersNotified,
    fixedAlpha: fixedAlphaResult.usersMarkedAlpha,
    flexible: flexibleReminderResult.usersNotified,
  });

  return {
    checkIn: checkInResult,
    checkOut: checkOutResult,
    lateCheckOut: lateCheckOutResult,
    fixedAlpha: fixedAlphaResult,
    flexible: flexibleReminderResult,
  };
}

/**
 * Send reminders to Flexible users who have exceeded their target hours
 * Triggers every ~1 hour after passing the target duration
 */
export async function processFlexibleReminders(): Promise<{
  usersNotified: number;
  details: string[];
}> {
  try {
    const now = new Date();

    const activeFlexibleSessions =
      await attendanceRepo.findActiveFlexibleSessionsWithUser();

    if (activeFlexibleSessions.length === 0) {
      return { usersNotified: 0, details: [] };
    }

    const details: string[] = [];
    let notified = 0;

    for (const session of activeFlexibleSessions) {
      const checkInTime = new Date(session.checkIn).getTime();
      const currentTime = now.getTime();
      const durationHours = (currentTime - checkInTime) / (1000 * 60 * 60);
      const targetHours = session.user.flexibleTargetHour || 8;

      if (durationHours > targetHours) {
        const excessHours = durationHours - targetHours;

        const remainder = excessHours % 1;

        if (remainder >= 0 && remainder <= 0.25) {
          const reminderKey = `attendance:reminder:flexible:${session.user.id}:${getDateKey(now)}:${getFlexibleHourBucket(excessHours)}`;
          const shouldSend = await acquireReminderLock(reminderKey, 60 * 60);
          if (!shouldSend) {
            continue;
          }

          const hoursWorked = Math.floor(durationHours);
          const minutesWorked = Math.round((durationHours % 1) * 60);

          await sendPushNotification(
            session.user.id,
            "⏰ Reminder Check-Out (Fleksibel)",
            `Halo ${session.user.name}, durasi kerja Anda sudah mencapai ${hoursWorked} jam ${minutesWorked} menit (Target: ${targetHours} jam). Harap segera Check-Out jika sudah selesai.`,
            {
              type: "attendance_reminder",
              action: "check_out",
            },
          );

          notified++;
          details.push(
            `${session.user.name} (${hoursWorked}h ${minutesWorked}m)`,
          );
        }
      }
    }

    if (notified > 0) {
      console.log(
        `[AttendanceAlert] Sent FLEXIBLE reminder to ${notified} users`,
      );
    }

    return { usersNotified: notified, details };
  } catch (error) {
    console.error("[AttendanceAlert] Error sending flexible reminders:", error);
    return { usersNotified: 0, details: [] };
  }
}

// ==========================================
// LEGACY FUNCTIONS (for backward compatibility)
// ==========================================

/**
 * @deprecated Use processCheckInReminders() instead
 */
export async function sendCheckInReminder(): Promise<number> {
  const result = await processCheckInReminders();
  return result.usersNotified;
}

/**
 * @deprecated Use processCheckOutReminders() instead
 */
export async function sendCheckOutReminder(): Promise<number> {
  const result = await processCheckOutReminders();
  return result.usersNotified;
}

/**
 * @deprecated Use runScheduledAttendanceCheck() instead
 */
export async function runDailyAttendanceCheck(): Promise<void> {
  await runScheduledAttendanceCheck();
}
