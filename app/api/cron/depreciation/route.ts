import { NextRequest } from "next/server";
import { DepreciationCronService } from "@/modules/inventory";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

const depreciationCronService = new DepreciationCronService();

/** Jalankan cron penyusutan aset bulanan. */
export async function GET(req: NextRequest) {
  try {
    const env = getEnv();
    const authHeader = req.headers.get("authorization");

    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return ApiErrors.unauthorized("Tidak terautentikasi");
    }

    const result = await depreciationCronService.runMonthlyCycle();
    return apiSuccess(
      { processed: result.processed },
      {
        message: `Depreciation run completed. Processed ${result.processed} assets.`,
      },
    );
  } catch (error: unknown) {
    logger.error("Depreciation Cron Failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Depreciation cron failed";
    return ApiErrors.internalError(errorMessage);
  }
}
