import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  RecurringEngineService,
  RecurringRepository,
  JournalRepository,
  ChartOfAccountRepository,
  PeriodRepository,
} from "@/modules/accounting";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info(
    "[cron:accounting:recurring] Starting recurring journal generation",
  );

  const engine = new RecurringEngineService(
    new RecurringRepository(),
    new JournalRepository(),
    new ChartOfAccountRepository(),
    new PeriodRepository(),
  );

  const result = await engine.processAll(new Date());

  logger.info("[cron:accounting:recurring] Complete", result);

  return NextResponse.json(result);
}
