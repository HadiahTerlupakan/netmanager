import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger } from "@/lib/logger";

const inventoryRouteService = getInventoryRouteService();

async function requireAdmin() {
  const session = await getServerSession(authConfig);
  if (!session) {
    return null;
  }
  return session;
}

/**
 * GET /api/inventory/opname/calculate
 * Hitung data awal opname untuk gudang tertentu.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = (await requireAdmin()) as { user: { id: string } } | null;
    if (!session) {
      logger.warn(
        "Unauthorized access attempt to GET /api/inventory/opname/calculate",
      );
      return NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      );
    }

    const gudangId = req.nextUrl.searchParams.get("gudangId");
    if (!gudangId) {
      return NextResponse.json(
        { error: "Gudang ID harus diisi" },
        { status: 400 },
      );
    }

    const dbStart = Date.now();
    const result = await inventoryRouteService.calculateOpname(gudangId);

    logger.dbOperation(
      "findMany",
      "BarangGudang+Relations",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "GET",
      "/api/inventory/opname/calculate",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        gudangId,
        totalBarang: result.summary.totalBarang,
        totalStok: result.summary.totalStok,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Error getting stock opname data", error as Error, {
      path: "/api/inventory/opname/calculate",
      method: "GET",
    });
    return NextResponse.json(
      { error: "Gagal mengambil data stock opname" },
      { status: 500 },
    );
  }
}
