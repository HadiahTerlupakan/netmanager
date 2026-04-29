import { createNotification } from "@/modules/notification";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { getDateKey } from "./AttendanceAlertClock";
import { getAttendanceRepository } from "./AttendanceAlertDependencies";
import { acquireReminderLock } from "./AttendanceAlertLockService";

/** Kirim alert attendance individu ke user tertentu. */
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

/** Proses attendance belum checkout untuk alert akhir hari. */
export async function processIncompleteAttendance(): Promise<{
  missingCheckOut: number;
  usersNotified: string[];
}> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setTime(toStartOfDay(startOfDay).getTime());
  const endOfDay = new Date(now);
  endOfDay.setTime(toEndOfDay(endOfDay).getTime());

  const incomplete =
    await getAttendanceRepository().findIncompleteCheckOutSelect(
      startOfDay,
      endOfDay,
    );
  const usersNotified: string[] = [];

  for (const attendance of incomplete) {
    const reminderKey = `attendance:alert:missing_checkout:${attendance.userId}:${getDateKey()}`;
    const shouldSend = await acquireReminderLock(reminderKey, 12 * 60 * 60);
    if (!shouldSend) continue;
    await sendAttendanceAlertToUser(attendance.userId, "missing_checkout");
    usersNotified.push(attendance.user.name || attendance.userId);
  }

  return { missingCheckOut: incomplete.length, usersNotified };
}
