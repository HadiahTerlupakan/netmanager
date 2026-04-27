import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger } from "@/lib/logger";

const inventoryRouteService = getInventoryRouteService();

/**
 * GET /api/inventory/opname/report
 * Get stock report per warehouse showing current stock status,
 * breakdown by condition (BARU/BEKAS/RUSAK), and lost items (isHilang)
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const gudangId = req.nextUrl.searchParams.get("gudangId") || undefined;
    const dbStart = Date.now();
    const result = await inventoryRouteService.getOpnameReport(gudangId);

    logger.dbOperation(
      "findMany",
      "Gudang+BarangGudang+Transactions",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "GET",
      "/api/inventory/opname/report",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        gudangCount: result.gudangList.length,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error generating stock report", error as Error);
    return NextResponse.json(
      { error: "Gagal menghasilkan laporan stok" },
      { status: 500 },
    );
  }
}
