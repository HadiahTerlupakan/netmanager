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
import { cleanupStaleFcmTokenArrays } from "@/modules/notification";

export const dynamic = "force-dynamic";

const CRON_LOCK_TTL_SECONDS = 115;

/**
 * Cron endpoint untuk periodic cleanup fcmTokens[] yang sudah stale.
 *
 * Dijalankan harian. Menghapus fcmTokens[] dari user/mitra yang
 * `pushTokenUpdatedAt` lebih dari 30 hari — token kemungkinan
 * sudah tidak valid (user uninstall app, ganti HP, dll).
 *
 * Dipanggil oleh external scheduler (Vercel Cron, GitHub Actions, dll).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const lockResult = await acquireCronLock(
      "route:cleanupStaleFcmTokens",
      CRON_LOCK_TTL_SECONDS,
    );
    if (lockResult === "unavailable") {
      return apiError(CRON_LOCK_UNAVAILABLE_MESSAGE, ErrorCodes.CONFLICT, {
        status: 409,
      });
    }
    if (lockResult === "locked") {
      return apiError("Cron sedang berjalan", ErrorCodes.CONFLICT, {
        status: 409,
      });
    }

    const result = await cleanupStaleFcmTokenArrays();

    logger.info(
      `[CronCleanup] Stale FCM tokens: ${result.usersCleaned} users, ${result.mitrasCleaned} mitras cleaned, ${result.tokensRemoved} tokens removed`,
    );

    return apiSuccess(result);
  } catch (error) {
    logger.error("[CronCleanup] FCM token cleanup error:", error);
    return ApiErrors.internalError("Gagal cleanup stale FCM tokens");
  }
}
