import { NextRequest } from "next/server";

import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { runStockOpnameReminderCron } from "@/modules/inventory";

/** Pengingat jadwal stock opname bulanan (harian 08.00 WIB). */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return ApiErrors.unauthorized("Tidak terautentikasi");
  }
  try {
    return apiSuccess(await runStockOpnameReminderCron());
  } catch (error) {
    logger.error("[Cron Stock Opname Reminder] Error:", error);
    return ApiErrors.internalError("Terjadi kesalahan");
  }
}
