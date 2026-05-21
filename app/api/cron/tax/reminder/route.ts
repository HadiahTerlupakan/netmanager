import { NextRequest } from "next/server";
import { getTaxReminderService } from "@/modules/tax";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Daily cron: check tax payment deadlines and calculate penalties */
export async function GET(req: NextRequest) {
  try {
    const env = getEnv();
    const authHeader = req.headers.get("authorization");

    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const service = getTaxReminderService();
    const result = await service.checkAndSendReminders();

    logger.info("Tax reminder cron completed", result);
    return apiSuccess(result, {
      message: `Tax reminder: ${result.sent} reminders, ${result.penalties} penalties applied`,
    });
  } catch (error: unknown) {
    logger.error("Tax Reminder Cron Failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Tax reminder cron failed";
    return ApiErrors.internalError(errorMessage);
  }
}
