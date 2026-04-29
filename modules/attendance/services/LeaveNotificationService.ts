import { logger, logActivitySafe } from "@/lib/logger";
import { createNotification } from "@/modules/notification";

const LEAVE_NOTIFICATION_LINK = "/karyawan/izin";

export class LeaveNotificationService {
  /** Catat activity audit untuk perubahan leave. */
  logActivity(input: {
    action: string;
    subject: string;
    userId: string;
    details: Record<string, unknown>;
  }): void {
    logActivitySafe(input);
  }

  /** Kirim notifikasi perubahan leave ke user terkait. */
  async sendNotification(input: {
    userId: string;
    title: string;
    message: string;
    sourceId: string;
  }): Promise<void> {
    try {
      await createNotification({
        type: "SYSTEM",
        priority: "NORMAL",
        title: input.title,
        message: input.message,
        link: LEAVE_NOTIFICATION_LINK,
        userId: input.userId,
        sourceType: "LEAVE",
        sourceId: input.sourceId,
      });
    } catch (error) {
      logger.error("Failed to notify user", error);
    }
  }
}
