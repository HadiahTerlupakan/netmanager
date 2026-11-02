import { NextRequest } from "next/server";
import {
  apiError,
  ApiErrors,
  apiSuccess,
  ErrorCodes,
} from "@/lib/api-response";
import {
  acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE,
} from "@/lib/cron-lock";
import { logger } from "@/lib/logger";
import {
  cleanupExpiredNotificationLogs,
  NOTIFICATION_LOGS_CLEANUP_CONFIG,
} from "@/modules/notification";

export const dynamic = "force-dynamic";

const CRON_LOCK_TTL_SECONDS = 55;

/** Cron endpoint untuk cleanup data observability yang sudah expired. */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const lockResult = await acquireCronLock(
      "route:cleanupNotifLogs",
      CRON_LOCK_TTL_SECONDS,
    );
    if (lockResult === "unavailable") {
      return apiError(CRON_LOCK_UNAVAILABLE_MESSAGE, ErrorCodes.CONFLICT, {
        status: 409,
      });
    }

    const result = await cleanupExpiredNotificationLogs();

    logger.info(
      `[CronCleanup] Notification logs cleanup: ${result.emailLogsDeleted} email logs (>${NOTIFICATION_LOGS_CLEANUP_CONFIG.emailLogRetentionDays}d) + ${result.dlqResolvedDeleted} resolved DLQ (>${NOTIFICATION_LOGS_CLEANUP_CONFIG.dlqResolvedRetentionDays}d) deleted`,
    );

    return apiSuccess(result);
  } catch (error) {
    logger.error("[CronCleanup] Error:", error);
    return ApiErrors.internalError("Gagal cleanup notification logs");
  }
}
