import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  getInventoryRouteService,
  OPNAME_PESAN,
  pesanGagalMuatOpname,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";

/**
 * GET /api/inventory/opname/calculate
 * Hitung data awal opname untuk gudang tertentu.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("opname:create"))) {
    return ApiErrors.forbidden(OPNAME_PESAN.tanpaIzinCatat);
  }

  const gudangId = req.nextUrl.searchParams.get("gudangId");
  if (!gudangId) {
    return ApiErrors.badRequest(OPNAME_PESAN.gudangBelumDipilih);
  }

  try {
    const inventoryRouteService = getInventoryRouteService();
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
        userId: user.id,
        gudangId,
        totalBarang: result.summary.totalBarang,
        totalStok: result.summary.totalStok,
      },
    );

    return apiSuccess(result);
  } catch (error) {
    logger.error("Error getting stock opname data", error as Error, {
      path: "/api/inventory/opname/calculate",
      method: "GET",
    });
    return ApiErrors.internalError(
      pesanGagalMuatOpname("Daftar barang di gudang ini"),
    );
  }
});
