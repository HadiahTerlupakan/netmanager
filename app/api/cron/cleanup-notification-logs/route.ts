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
import { prisma } from "@/modules/database";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const EMAIL_LOG_RETENTION_DAYS = 90;
const DLQ_RESOLVED_RETENTION_DAYS = 30;

/** Cron endpoint untuk cleanup data observability yang sudah expired. */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const lockResult = await acquireCronLock("route:cleanupNotifLogs", 55);
    if (lockResult === "unavailable") {
      return apiError(CRON_LOCK_UNAVAILABLE_MESSAGE, ErrorCodes.CONFLICT, {
        status: 409,
      });
    }

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

    logger.info(
      `[CronCleanup] Notification logs cleanup: ${emailDeleted.count} email logs (>${EMAIL_LOG_RETENTION_DAYS}d) + ${dlqDeleted.count} resolved DLQ (>${DLQ_RESOLVED_RETENTION_DAYS}d) deleted`,
    );

    return apiSuccess({
      emailLogsDeleted: emailDeleted.count,
      dlqResolvedDeleted: dlqDeleted.count,
    });
  } catch (error) {
    logger.error("[CronCleanup] Error:", error);
    return ApiErrors.internalError("Gagal cleanup notification logs");
  }
}
