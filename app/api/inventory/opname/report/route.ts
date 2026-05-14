import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";

/**
 * GET /api/inventory/opname/report
 * Get stock report per warehouse showing current stock status,
 * breakdown by condition (BARU/BEKAS/RUSAK), and lost items (isHilang)
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat laporan opname",
    );
  }

  try {
    const gudangId = req.nextUrl.searchParams.get("gudangId") || undefined;
    const inventoryRouteService = getInventoryRouteService();
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
        userId: user.id,
        gudangCount: result.gudangList.length,
      },
    );

    return apiSuccess(result);
  } catch (error) {
    logger.error("Error generating stock report", error as Error);
    return ApiErrors.internalError("Gagal menghasilkan laporan stok");
  }
});
