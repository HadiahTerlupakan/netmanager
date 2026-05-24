import { NextRequest } from "next/server";
import { getARAgingService } from "@/modules/finance";
import { acquireCronLock } from "@/lib/cron-lock";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const lock = await acquireCronLock("ar-aging-snapshot", 300);
    if (lock !== "acquired") {
      return apiSuccess({ skipped: true, reason: lock });
    }

    return apiSuccess(await getARAgingService().computeAndSave());
  } catch (error: unknown) {
    logger.error("[Cron AR Aging] Error:", error);
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return ApiErrors.internalError(message);
  }
}
