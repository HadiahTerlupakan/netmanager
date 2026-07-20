import { logger } from "@/lib/logger";
import {
  sendPushNotification,
  WhatsAppSenderService,
} from "@/modules/notification";
import { getDateKey, getFlexibleHourBucket } from "./AttendanceAlertClock";
import { getAttendanceRepository } from "./AttendanceAlertDependencies";
import { acquireReminderLock } from "./AttendanceAlertLockService";
import {
  getFlexibleUsersNeedingNoCheckInReminder,
  getUsersNeedingCheckInReminder,
  getUsersNeedingCheckOutReminder,
} from "./AttendanceReminderQueryService";
import type { ReminderResult, UserSchedule } from "./AttendanceAlertTypes";

const CHECK_IN_LOCK_TTL_SECONDS = 60 * 60;
const CHECK_OUT_LOCK_TTL_SECONDS = 60 * 60;
const LATE_CHECK_OUT_LOCK_TTL_SECONDS = 2 * 60 * 60;
const FLEXIBLE_LOCK_TTL_SECONDS = 60 * 60;
const FLEXIBLE_NO_CHECKIN_LOCK_TTL_SECONDS = 12 * 60 * 60;

type ReminderPayload = {
  lockKey: string;
  ttlSeconds: number;
  title: string;
  message: string;
  detail: string;
  payload: { type: string; action: string };
};

type ContactTarget = {
  userId: string;
  pushToken: string | null;
  phone: string | null;
};

let waSender: WhatsAppSenderService | null = null;

function getWaSender(): WhatsAppSenderService {
  waSender ??= new WhatsAppSenderService();
  return waSender;
}

/** Kirim reminder check-in ke user yang belum absen masuk. */
export async function processCheckInReminders(
  reminderMinutes: number = 30,
): Promise<ReminderResult> {
  try {
    const users = await getUsersNeedingCheckInReminder(reminderMinutes);
    if (users.length === 0) {
      logger.info(
        "[AttendanceAlert] No users need check-in reminder at this time",
      );
      return { usersNotified: 0, details: [] };
    }
    const result = await sendScheduledReminders(users, buildCheckInReminder);
    logger.info(
      `[AttendanceAlert] Sent check-in reminder to ${result.usersNotified} users`,
    );
    return result;
  } catch (error) {
    logger.error("[AttendanceAlert] Error sending check-in reminders:", error);
    return { usersNotified: 0, details: [] };
  }
}

/** Kirim reminder check-out ke user yang belum absen pulang. */
export async function processCheckOutReminders(
  reminderMinutes: number = 30,
): Promise<ReminderResult> {
  try {
    const users = await getUsersNeedingCheckOutReminder(reminderMinutes);
    if (users.length === 0) {
      logger.info(
        "[AttendanceAlert] No users need check-out reminder at this time",
      );
      return { usersNotified: 0, details: [] };
    }
    const result = await sendScheduledReminders(users, buildCheckOutReminder);
    logger.info(
      `[AttendanceAlert] Sent check-out reminder to ${result.usersNotified} users`,
    );
    return result;
  } catch (error) {
    logger.error("[AttendanceAlert] Error sending check-out reminders:", error);
    return { usersNotified: 0, details: [] };
  }
}

const LATE_CHECK_OUT_REMINDER_MINUTES = 180;
const LATE_CHECK_OUT_WINDOW_MINUTES = 60;

/** Kirim reminder check-out terlambat beberapa jam setelah shift selesai. */
export async function processLateCheckOutReminders(): Promise<ReminderResult> {
  try {
    const users = await getUsersNeedingCheckOutReminder(
      LATE_CHECK_OUT_REMINDER_MINUTES,
      LATE_CHECK_OUT_WINDOW_MINUTES,
    );
    return await sendLateCheckOutReminders(users);
  } catch (error) {
    logger.error(
      "[AttendanceAlert] Error sending late check-out reminders:",
      error,
    );
    return { usersNotified: 0, details: [] };
  }
}

async function sendLateCheckOutReminders(users: UserSchedule[]) {
  if (users.length === 0) return { usersNotified: 0, details: [] };
  const result = await sendScheduledReminders(users, buildLateCheckOutReminder);
  logger.info(
    `[AttendanceAlert] Sent LATE check-out reminder to ${result.usersNotified} users`,
  );
  return result;
}

/** Kirim reminder check-out untuk user flexible yang melewati target jam. */
export async function processFlexibleReminders(): Promise<ReminderResult> {
  try {
    const result = await sendFlexibleReminders(new Date());
    logFlexibleReminderResult(result.usersNotified);
    return result;
  } catch (error) {
    logger.error("[AttendanceAlert] Error sending flexible reminders:", error);
    return { usersNotified: 0, details: [] };
  }
}

/**
 * Reminder 1x/hari untuk flexible yang belum check-in sama sekali di hari kerja
 * (window mulai jam 12 lokal tenant).
 */
export async function processFlexibleNoCheckInReminders(): Promise<ReminderResult> {
  try {
    const users = await getFlexibleUsersNeedingNoCheckInReminder();
    if (users.length === 0) {
      return { usersNotified: 0, details: [] };
    }
    const result = await sendScheduledReminders(
      users,
      buildFlexibleNoCheckInReminder,
    );
    if (result.usersNotified > 0) {
      logger.info(
        `[AttendanceAlert] Sent FLEXIBLE no-checkin reminder to ${result.usersNotified} users`,
      );
    }
    return result;
  } catch (error) {
    logger.error(
      "[AttendanceAlert] Error sending flexible no-checkin reminders:",
      error,
    );
    return { usersNotified: 0, details: [] };
  }
}

async function sendFlexibleReminders(now: Date): Promise<ReminderResult> {
  const activeSessions =
    await getAttendanceRepository().findActiveFlexibleSessionsWithUser();
  const reminders = await Promise.all(
    activeSessions.map((session) => buildFlexibleReminder(session, now)),
  );
  return notifyFlexibleReminders(activeSessions, reminders);
}

async function notifyFlexibleReminders(
  sessions: Array<{
    user: { id: string; pushToken?: string | null; phone?: string | null };
  }>,
  reminders: Array<Awaited<ReturnType<typeof buildFlexibleReminder>>>,
) {
  const details: string[] = [];
  for (const [index, reminder] of reminders.entries()) {
    if (!reminder) continue;
    const session = sessions[index];
    await deliverReminder(
      {
        userId: session.user.id,
        pushToken: session.user.pushToken ?? null,
        phone: session.user.phone ?? null,
      },
      reminder,
    );
    details.push(reminder.detail);
  }
  return { usersNotified: details.length, details };
}

function logFlexibleReminderResult(notified: number) {
  if (notified === 0) return;
  logger.info(`[AttendanceAlert] Sent FLEXIBLE reminder to ${notified} users`);
}

async function sendScheduledReminders(
  users: UserSchedule[],
  buildReminder: (user: UserSchedule) => ReminderPayload,
): Promise<ReminderResult> {
  const details: string[] = [];
  let notified = 0;

  for (const user of users) {
    if (!user.pushToken && !user.phone) continue;
    const reminder = buildReminder(user);
    const shouldSend = await acquireReminderLock(
      reminder.lockKey,
      reminder.ttlSeconds,
    );
    if (!shouldSend) continue;
    await deliverReminder(
      {
        userId: user.userId,
        pushToken: user.pushToken,
        phone: user.phone,
      },
      reminder,
    );
    notified++;
    details.push(reminder.detail);
  }

  return { usersNotified: notified, details };
}

async function deliverReminder(
  target: ContactTarget,
  reminder: Pick<ReminderPayload, "title" | "message" | "payload">,
): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (target.pushToken) {
    tasks.push(
      sendPushNotification(
        target.userId,
        reminder.title,
        reminder.message,
        reminder.payload,
      ),
    );
  }

  if (target.phone) {
    tasks.push(sendWhatsAppReminder(target.phone, reminder));
  }

  await Promise.all(tasks);
}

async function sendWhatsAppReminder(
  phone: string,
  reminder: Pick<ReminderPayload, "title" | "message">,
): Promise<void> {
  try {
    const result = await getWaSender().send({
      phone,
      message: `*${reminder.title}*\n\n${reminder.message}`,
      accountType: "INTERNAL",
    });
    if (!result.success) {
      logger.warn(
        `[AttendanceAlert] WA failed for ${phone}: ${result.error ?? "unknown"}`,
      );
    }
  } catch (error) {
    logger.warn(
      `[AttendanceAlert] WA send error for ${phone}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function buildCheckInReminder(user: UserSchedule): ReminderPayload {
  return {
    lockKey: `attendance:reminder:checkin:${user.userId}:${getDateKey()}`,
    ttlSeconds: CHECK_IN_LOCK_TTL_SECONDS,
    title: "⏰ Reminder Absensi — Telat Check-In",
    message: `Anda sudah melewati jam masuk (${user.startWorkTime}) dan belum check-in. Segera absen masuk agar tidak tercatat telat.`,
    detail: `${user.userName} (${user.startWorkTime})`,
    payload: { type: "attendance_reminder", action: "check_in" },
  };
}

function buildCheckOutReminder(user: UserSchedule): ReminderPayload {
  return {
    lockKey: `attendance:reminder:checkout:${user.userId}:${getDateKey()}`,
    ttlSeconds: CHECK_OUT_LOCK_TTL_SECONDS,
    title: "🏠 Reminder Check-Out",
    message: `Sudah lewat jam pulang (${user.endWorkTime}) dan Anda belum check-out. Segera absen pulang agar jam kerja tercatat lengkap.`,
    detail: `${user.userName} (${user.endWorkTime})`,
    payload: { type: "attendance_reminder", action: "check_out" },
  };
}

function buildLateCheckOutReminder(user: UserSchedule): ReminderPayload {
  return {
    lockKey: `attendance:reminder:late_checkout:${user.userId}:${getDateKey()}`,
    ttlSeconds: LATE_CHECK_OUT_LOCK_TTL_SECONDS,
    title: "🛑 Belum Absen Pulang?",
    message: `Sudah 3 jam lewat dari jam pulang (${user.endWorkTime}). Jangan lupa Check-Out agar tidak kena penalti!`,
    detail: `${user.userName} (${user.endWorkTime})`,
    payload: { type: "attendance_reminder", action: "check_out" },
  };
}

function buildFlexibleNoCheckInReminder(user: UserSchedule): ReminderPayload {
  return {
    lockKey: `attendance:reminder:flexible_nocheckin:${user.userId}:${getDateKey()}`,
    ttlSeconds: FLEXIBLE_NO_CHECKIN_LOCK_TTL_SECONDS,
    title: "⏰ Reminder Absensi (Fleksibel)",
    message:
      "Anda belum melakukan check-in sama sekali hari ini. Segera absen masuk agar kehadiran tercatat.",
    detail: `${user.userName} (flexible no-checkin)`,
    payload: { type: "attendance_reminder", action: "check_in" },
  };
}

async function buildFlexibleReminder(
  session: {
    checkIn: Date;
    user: {
      id: string;
      name: string | null;
      flexibleTargetHour: number | null;
    };
  },
  now: Date,
) {
  const durationHours =
    (now.getTime() - new Date(session.checkIn).getTime()) / (1000 * 60 * 60);
  const targetHours = session.user.flexibleTargetHour || 8;
  if (durationHours <= targetHours) return null;

  const excessHours = durationHours - targetHours;
  const remainder = excessHours % 1;
  if (remainder < 0 || remainder > 0.25) return null;

  const lockKey = `attendance:reminder:flexible:${session.user.id}:${getDateKey(now)}:${getFlexibleHourBucket(excessHours)}`;
  const shouldSend = await acquireReminderLock(
    lockKey,
    FLEXIBLE_LOCK_TTL_SECONDS,
  );
  if (!shouldSend) return null;

  const hoursWorked = Math.floor(durationHours);
  const minutesWorked = Math.round((durationHours % 1) * 60);
  return {
    title: "⏰ Reminder Check-Out (Fleksibel)",
    message: `Halo ${session.user.name}, durasi kerja Anda sudah mencapai ${hoursWorked} jam ${minutesWorked} menit (Target: ${targetHours} jam). Harap segera Check-Out jika sudah selesai.`,
    detail: `${session.user.name} (${hoursWorked}h ${minutesWorked}m)`,
    payload: { type: "attendance_reminder", action: "check_out" },
  };
}
