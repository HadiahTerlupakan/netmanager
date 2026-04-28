import { NextRequest } from "next/server";
import { runWorkOrderReminderCron } from "@/modules/work-order";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    return apiSuccess(await runWorkOrderReminderCron());
  } catch (error: unknown) {
    logger.error("[Cron WO Reminder] Error:", error);
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return ApiErrors.internalError(message);
  }
}
