import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getBhpUsoService } from "@/modules/tax";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  logger.info("[cron:tax:bhp-uso] Starting BHP/USO calculation");

  const bhpUsoService = getBhpUsoService();
  const summary = await bhpUsoService.calculateAllForPreviousMonth();

  logger.info("[cron:tax:bhp-uso] Complete", summary);

  return NextResponse.json(summary);
}
