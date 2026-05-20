import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getRecurringEngineService } from "@/modules/accounting";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info(
    "[cron:accounting:recurring] Starting recurring journal generation",
  );

  const result = await getRecurringEngineService().processAll(new Date());

  logger.info("[cron:accounting:recurring] Complete", result);

  return NextResponse.json(result);
}
