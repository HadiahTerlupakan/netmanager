import { prisma } from "@/modules/database";

const EMAIL_LOG_RETENTION_DAYS = 90;
const DLQ_RESOLVED_RETENTION_DAYS = 30;

export interface NotificationLogsCleanupResult {
  emailLogsDeleted: number;
  dlqResolvedDeleted: number;
}

/**
 * Cleanup observability data yang sudah expired:
 * - Email delivery log dengan status terminal (SENT/BOUNCED) > 90 hari
 * - Dead letter notification yang sudah resolved > 30 hari
 *
 * Catatan: status FAILED tidak di-cleanup agar tetap auditable.
 * Dipanggil dari cron job (`/api/cron/cleanup-notification-logs`).
 */
export async function cleanupExpiredNotificationLogs(): Promise<NotificationLogsCleanupResult> {
  const cutoffEmailLog = new Date();
  cutoffEmailLog.setDate(cutoffEmailLog.getDate() - EMAIL_LOG_RETENTION_DAYS);

  const cutoffDlqResolved = new Date();
  cutoffDlqResolved.setDate(
    cutoffDlqResolved.getDate() - DLQ_RESOLVED_RETENTION_DAYS,
  );

  const [emailDeleted, dlqDeleted] = await Promise.all([
    prisma.emailDeliveryLog.deleteMany({
      where: {
        createdAt: { lt: cutoffEmailLog },
        status: { in: ["SENT", "BOUNCED"] },
      },
    }),
    prisma.notificationDeadLetter.deleteMany({
      where: {
        resolvedAt: { not: null, lt: cutoffDlqResolved },
      },
    }),
  ]);

  return {
    emailLogsDeleted: emailDeleted.count,
    dlqResolvedDeleted: dlqDeleted.count,
  };
}

/** Retention configuration untuk dipakai di logger/observability. */
export const NOTIFICATION_LOGS_CLEANUP_CONFIG = {
  emailLogRetentionDays: EMAIL_LOG_RETENTION_DAYS,
  dlqResolvedRetentionDays: DLQ_RESOLVED_RETENTION_DAYS,
} as const;
