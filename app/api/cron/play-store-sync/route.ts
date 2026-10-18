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
import { PlayStoreReleaseService } from "@/modules/app-version";

export const dynamic = "force-dynamic";

const CRON_LOCK_TTL_SECONDS = 300;

/**
 * Catat rilis produksi Google Play yang baru terlihat. Versi minimum aplikasi
 * mobile dihitung dari catatan ini, jadi tanpa job ini batasnya tidak pernah
 * naik. Dijalankan tiap jam oleh crontab di cron/entrypoint.sh.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (
      !cronSecret ||
      request.headers.get("authorization") !== `Bearer ${cronSecret}`
    ) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const lockResult = await acquireCronLock(
      "route:playStoreSync",
      CRON_LOCK_TTL_SECONDS,
    );
    if (lockResult !== "acquired") {
      const message =
        lockResult === "unavailable"
          ? CRON_LOCK_UNAVAILABLE_MESSAGE
          : "Cron sedang berjalan";
      return apiError(message, ErrorCodes.CONFLICT, { status: 409 });
    }

    const result = await new PlayStoreReleaseService().sync();
    logger.info("[PlayStoreSync] Selesai", result);
    return apiSuccess(result);
  } catch (error) {
    logger.error("[PlayStoreSync] Gagal membaca Google Play:", error);
    return ApiErrors.internalError("Gagal sinkronisasi rilis Play Store");
  }
}
