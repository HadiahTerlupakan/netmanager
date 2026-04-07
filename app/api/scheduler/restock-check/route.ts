import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getInventoryRestockCheckService } from "@/modules/inventory";

/**
 * POST /api/scheduler/restock-check
 * Protected by CRON_SECRET
 * Automatically triggered by external cron job
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }

  const service = getInventoryRestockCheckService();

  try {
    const result = await service.run();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    logger.error("Error in scheduler restock check", error as Error, {
      path: "/api/scheduler/restock-check",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
