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
    link: "/karyawan/absensi",
  });
  return true;
}

type IncompleteAttendance = Awaited<
  ReturnType<
    ReturnType<typeof getAttendanceRepository>["findIncompleteCheckOutSelect"]
  >
>[number];

/** Proses attendance belum checkout untuk alert akhir hari. */
export async function processIncompleteAttendance(): Promise<{
  missingCheckOut: number;
  usersNotified: string[];
}> {
  const incomplete = await findTodayIncompleteAttendances();
  const usersNotified = await notifyIncompleteAttendanceUsers(incomplete);
  return { missingCheckOut: incomplete.length, usersNotified };
}

async function findTodayIncompleteAttendances() {
  const now = new Date();
  const startOfDay = new Date(toStartOfDay(now));
  const endOfDay = new Date(toEndOfDay(now));
  return getAttendanceRepository().findIncompleteCheckOutSelect(
    startOfDay,
    endOfDay,
  );
}

async function notifyIncompleteAttendanceUsers(
  incompleteAttendances: IncompleteAttendance[],
) {
  const usersNotified: string[] = [];
  for (const attendance of incompleteAttendances) {
    if (!(await canSendMissingCheckoutAlert(attendance.userId))) continue;
    await sendAttendanceAlertToUser(attendance.userId, "missing_checkout");
    usersNotified.push(attendance.user.name || attendance.userId);
  }
  return usersNotified;
}

function buildMissingCheckoutReminderKey(userId: string) {
  return `attendance:alert:missing_checkout:${userId}:${getDateKey()}`;
}

async function canSendMissingCheckoutAlert(userId: string) {
  return acquireReminderLock(
    buildMissingCheckoutReminderKey(userId),
    12 * 60 * 60,
  );
}
