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
import { sinkronkanUploadTertunda } from "@/lib/upload/upload-sync";

export const dynamic = "force-dynamic";

const CRON_LOCK_TTL_SECONDS = 600;
const UPLOAD_SYNC_BATCH = 200;

/**
 * Unggah ke R2 berkas yang tersimpan hanya di volume lokal karena R2 gangguan
 * saat upload. Dijalankan tiap 10 menit oleh crontab di cron/entrypoint.sh.
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
      "route:uploadSync",
      CRON_LOCK_TTL_SECONDS,
    );
    if (lockResult !== "acquired") {
      const message =
        lockResult === "unavailable"
          ? CRON_LOCK_UNAVAILABLE_MESSAGE
          : "Cron sedang berjalan";
      return apiError(message, ErrorCodes.CONFLICT, { status: 409 });
    }

    const result = await sinkronkanUploadTertunda(UPLOAD_SYNC_BATCH);
    if (result.tersinkron || result.gagal || result.hilang) {
      logger.info("[UploadSync] Selesai", result);
    }
    return apiSuccess(result);
  } catch (error) {
    logger.error("[UploadSync] Gagal sinkron upload ke R2:", error);
    return ApiErrors.internalError("Gagal sinkronisasi upload ke R2");
  }
}
