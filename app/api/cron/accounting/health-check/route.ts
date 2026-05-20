import { NextRequest, NextResponse } from "next/server";
import { runAccountingHealthCheck } from "@/modules/accounting";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAccountingHealthCheck();
  return NextResponse.json(result, { status: result.healthy ? 200 : 500 });
}
