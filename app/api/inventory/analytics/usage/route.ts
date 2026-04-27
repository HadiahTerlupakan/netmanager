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
 * GET /api/inventory/analytics/usage
 * Get usage analytics for a specific barang and gudang
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  try {
    const session = await requireAdmin();
    if (!session) {
      logger.warn(
        "Unauthorized access attempt to GET /api/inventory/analytics/usage",
      );
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const searchParams = req.nextUrl.searchParams;
    const barangId = searchParams.get("barangId");
    const gudangId = searchParams.get("gudangId");
    const days = parseInt(searchParams.get("days") || "30");

    if (!barangId || !gudangId) {
      return apiError(
        "Barang ID dan Gudang ID harus diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    try {
      const dbStart = Date.now();
      const analytics = await inventoryRouteService.getUsageAnalytics({
        barangId,
        gudangId,
        days,
      });

      logger.dbOperation(
        "aggregate",
        "BarangKeluar+MonthlyAnalytics",
        Date.now() - dbStart,
      );

      logger.apiRequest(
        "GET",
        "/api/inventory/analytics/usage",
        200,
        Date.now() - startTime,
        {
          userId: session.user.id,
          barangId,
          gudangId,
          days,
          totalUsage: analytics.totalUsage,
          avgDailyUsage: analytics.avgDailyUsage,
        },
      );

      return apiSuccess(analytics);
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching usage analytics", err, {
      path: "/api/inventory/analytics/usage",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat analisis penggunaan");
  }
}
