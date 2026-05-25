import { NextRequest } from "next/server";
import { getCustomerCohortService } from "@/modules/finance";
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

    const lock = await acquireCronLock("customer-cohort", 600);
    if (lock !== "acquired") {
      return apiSuccess({ skipped: true, reason: lock });
    }

    return apiSuccess(await getCustomerCohortService().computeAndSaveAll());
  } catch (error: unknown) {
    logger.error("[Cron Customer Cohort] Error:", error);
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return ApiErrors.internalError(message);
  }
}
