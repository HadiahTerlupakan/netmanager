import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import {
  getAttendanceRepository,
  getUserLookupService,
} from "./AttendanceAlertDependencies";
import { isInReminderWindow, isWorkDay } from "./AttendanceAlertClock";
import type { UserSchedule } from "./AttendanceAlertTypes";

/** Ambil user yang perlu reminder check-in sesuai jadwal masing-masing. */
export async function getUsersNeedingCheckInReminder(
  reminderMinutes: number = 30,
): Promise<UserSchedule[]> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setTime(toStartOfDay(startOfDay).getTime());
  const endOfDay = new Date(now);
  endOfDay.setTime(toEndOfDay(endOfDay).getTime());

  const users =
    await getUserLookupService().findActiveWithPushTokenAndSchedule();
  const checkedInResults = await getAttendanceRepository().findCheckedInUserIds(
    startOfDay,
    endOfDay,
  );
  const checkedInUserIds = new Set(
    checkedInResults.map((attendance) => attendance.userId),
  );

  return users
    .filter((user) => {
      if (checkedInUserIds.has(user.id)) return false;
      if (!user.startWorkTime) return false;
      if (!isWorkDay(user.workDays, now)) return false;
      return isInReminderWindow(user.startWorkTime, reminderMinutes, now);
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

/** Ambil user yang perlu reminder check-out sesuai jadwal masing-masing. */
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
    await getAttendanceRepository().findIncompleteCheckOutWithUser(
      startOfDay,
      endOfDay,
    );

  return incompleteAttendance
    .filter((attendance) => {
      const user = attendance.user;
      if (!user.endWorkTime) return false;
      if (!isWorkDay(user.workDays, now)) return false;
      return isInReminderWindow(
        user.endWorkTime,
        reminderMinutes,
        now,
        windowMinutes,
      );
    })
    .map((attendance) => ({
      userId: attendance.user.id,
      userName: attendance.user.name,
      startWorkTime: attendance.user.startWorkTime || "08:00",
      endWorkTime: attendance.user.endWorkTime!,
      workDays: attendance.user.workDays,
      pushToken: attendance.user.pushToken,
    }));
}
