import { NextRequest } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authConfig } from "@/lib/auth";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger } from "@/lib/logger";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api-response";

const inventoryRouteService = getInventoryRouteService();

async function requireAdmin() {
  const session = (await getServerSession(authConfig)) as Session | null;
  if (!session) {
    return null;
  }
  return session;
}

/**
 * GET /api/inventory/barang/stock
 * Get current stock for specific barang and gudang
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await requireAdmin();
    if (!session) {
      logger.warn(
        "Unauthorized access attempt to GET /api/inventory/barang/stock",
      );
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const searchParams = req.nextUrl.searchParams;
    const barangId = searchParams.get("barangId");
    const gudangId = searchParams.get("gudangId");

    if (!barangId || !gudangId) {
      return apiError(
        "Barang ID dan Gudang ID harus diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const dbStart = Date.now();
    const result = await inventoryRouteService.getStockInfo(barangId, gudangId);

    logger.dbOperation(
      "findUnique",
      "BarangGudang+Relations",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "GET",
      "/api/inventory/barang/stock",
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        barangId,
        gudangId,
        stock: result.stok,
      },
    );

    return apiSuccess(result);
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching stock information", err, {
      path: "/api/inventory/barang/stock",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal mengambil informasi stok");
  }
}
