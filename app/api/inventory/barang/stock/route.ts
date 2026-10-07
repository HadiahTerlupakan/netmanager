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

/**
 * GET /api/inventory/barang/stock
 * Stok terkini satu barang di satu gudang.
 *
 * Gudang datang dari klien, jadi izinnya diperiksa dua lapis: `barang:read`
 * untuk bolehnya membaca stok sama sekali, dan lingkup site untuk bolehnya
 * membaca gudang YANG INI. Sebelumnya rute ini hanya memastikan ada sesi —
 * siapa pun yang bisa login dapat membaca stok gudang mana pun.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("barang:read"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk melihat stok");
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
    const result = await inventoryRouteService.getStockInfo(barangId, gudangId);
    logger.apiRequest(
      "GET",
      "/api/inventory/barang/stock",
      200,
      Date.now() - startTime,
      { userId: user.id, barangId, gudangId, stock: result.stok },
    );
    return apiSuccess(result);
  } catch (error) {
    logger.error("Error fetching stock information", error as Error, {
      path: "/api/inventory/barang/stock",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal mengambil informasi stok");
  }
});
