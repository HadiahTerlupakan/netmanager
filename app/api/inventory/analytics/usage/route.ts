import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  bolehAksesGudang,
  getInventoryRouteService,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import {
  createHandler,
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api";

const inventoryRouteService = getInventoryRouteService();
const DEFAULT_DAYS = 30;

/**
 * GET /api/inventory/analytics/usage
 * Analitik pemakaian satu barang di satu gudang.
 *
 * Sama seperti endpoint stok: gudang ditunjuk klien, jadi lingkup site-nya
 * diperiksa per gudang. Sebelumnya rute ini hanya memastikan ada sesi.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("barang:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat analitik pemakaian",
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const barangId = searchParams.get("barangId");
  const gudangId = searchParams.get("gudangId");
  const days = parseInt(searchParams.get("days") || String(DEFAULT_DAYS));

  if (!barangId || !gudangId) {
    return apiError(
      "Barang ID dan Gudang ID harus diisi",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const boleh = await bolehAksesGudang({
    userId: user.id,
    gudangId,
    permissions: await getUserPermissions(user.id),
    isSuperAdmin: isSuperAdmin(user),
    izinPembatas: ["barang:site_only", "gudang:site_only"],
  });
  if (!boleh) {
    return ApiErrors.forbidden("Gudang ini di luar site Anda");
  }

  try {
    const analytics = await inventoryRouteService.getUsageAnalytics({
      barangId,
      gudangId,
      days,
    });
    logger.apiRequest(
      "GET",
      "/api/inventory/analytics/usage",
      200,
      Date.now() - startTime,
      { userId: user.id, barangId, gudangId, days },
    );
    return apiSuccess(analytics);
  } catch (error) {
    logger.error("Error fetching usage analytics", error as Error, {
      path: "/api/inventory/analytics/usage",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal mengambil analitik pemakaian");
  }
});
