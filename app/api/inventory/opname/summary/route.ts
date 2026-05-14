import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";

/**
 * GET /api/inventory/opname/summary
 * Get stock opname summary per gudang
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat summary opname",
    );
  }

  try {
    const gudangId = req.nextUrl.searchParams.get("gudangId") || undefined;
    const inventoryRouteService = getInventoryRouteService();
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
        userId: user.id,
        count: summary.length,
        gudangId,
      },
    );

    return apiSuccess({ summary });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error getting stock opname summary", err, {
      path: "/api/inventory/opname/summary",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data summary stock opname");
  }
});
