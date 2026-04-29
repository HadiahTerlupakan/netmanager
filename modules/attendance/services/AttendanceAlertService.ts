import { logger } from "@/lib/logger";
import { processFixedHourAutoAlpha } from "./AttendanceFixedAutoAlphaService";
export { processFixedHourAutoAlpha } from "./AttendanceFixedAutoAlphaService";
export {
  processIncompleteAttendance,
  sendAttendanceAlertToUser,
} from "./AttendanceIncompleteAlertService";
export {
  getUsersNeedingCheckInReminder,
  getUsersNeedingCheckOutReminder,
} from "./AttendanceReminderQueryService";
import {
  processCheckInReminders,
  processCheckOutReminders,
  processFlexibleReminders,
  processLateCheckOutReminders,
} from "./AttendanceReminderDeliveryService";
export {
  processCheckInReminders,
  processCheckOutReminders,
  processFlexibleReminders,
  processLateCheckOutReminders,
} from "./AttendanceReminderDeliveryService";

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

  logger.info("[AttendanceAlert] Scheduled check completed:", {
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
