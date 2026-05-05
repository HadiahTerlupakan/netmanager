import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { AutomaticIsolationService } from "@/modules/finance";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    const CRON_SECRET = process.env.CRON_SECRET;

    if (!CRON_SECRET) {
      logger.error("[Cron] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 },
      );
    }

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      logger.warn("[Cron] Unauthorized attempt to run overdue check");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("[Cron] Starting daily overdue and isolation check");

    // Execute the daily check logic
    await AutomaticIsolationService.runDailyCheck();

    logger.info("[Cron] Completed daily overdue and isolation check");
    return NextResponse.json({
      success: true,
      message: "Daily check completed successfully",
    });
  } catch (error: unknown) {
    logger.error("[Cron] Error running daily check:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
