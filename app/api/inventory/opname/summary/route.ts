import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger } from "@/lib/logger";

const inventoryRouteService = getInventoryRouteService();

async function requireAdmin() {
  const session = await getServerSession(authConfig);
  if (!session || false) {
    return null;
  }
  return session;
}

/**
 * GET /api/inventory/opname/summary
 * Get stock opname summary per gudang
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const gudangId = req.nextUrl.searchParams.get("gudangId") || undefined;
    const dbStart = Date.now();
    const summary = await inventoryRouteService.getOpnameSummary(gudangId);

    logger.dbOperation(
      "findMany+groupBy",
      "BarangGudang+StockOpname",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "GET",
      "/api/inventory/opname/summary",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        count: summary.length,
        gudangId,
      },
    );

    return NextResponse.json({ summary });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error getting stock opname summary", err, {
      path: "/api/inventory/opname/summary",
      method: "GET",
    });
    return NextResponse.json(
      { error: "Gagal memuat data summary stock opname" },
      { status: 500 },
    );
  }
}
