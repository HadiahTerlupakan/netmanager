import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

const inventoryRouteService = getInventoryRouteService();

/**
 * GET /api/inventory/barang/stock/by-kondisi
 * Get stock breakdown by condition for specific barang and gudang
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await requireAdmin(req);
    if (session instanceof NextResponse) {
      return session;
    }

    const searchParams = req.nextUrl.searchParams;
    const barangId = searchParams.get("barangId");
    const gudangId = searchParams.get("gudangId");

    if (!barangId || !gudangId) {
      return ApiErrors.badRequest("Barang ID dan Gudang ID harus diisi");
    }

    const dbStart = Date.now();
    const result = await inventoryRouteService.getStockBreakdown(
      barangId,
      gudangId,
    );

    logger.dbOperation(
      "stock snapshot lookup",
      "BarangGudang",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "GET",
      "/api/inventory/barang/stock/by-kondisi",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        barangId,
        gudangId,
        totalStock: result.totalStock,
        stockPerKondisi: result.stockPerKondisi,
      },
    );

    return apiSuccess(result);
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching stock by condition", err, {
      path: "/api/inventory/barang/stock/by-kondisi",
      method: "GET",
    });
    return ApiErrors.internalError(
      "Gagal mengambil informasi stok per kondisi",
    );
  }
}
