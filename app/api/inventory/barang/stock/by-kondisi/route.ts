import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import {
  getInventoryRouteService,
  IZIN_PEMBATAS_BARANG,
  pesanGagalMuat,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

const inventoryRouteService = getInventoryRouteService();

const PESAN_GUDANG_BEDA_SITE =
  "Gudang ini milik site lain, jadi stoknya tidak bisa Anda lihat. Pilih gudang di site Anda.";

/**
 * GET /api/inventory/barang/stock/by-kondisi
 * Stok per kondisi satu barang di satu gudang. Gudang datang dari klien, jadi
 * lingkup site-nya diperiksa sama seperti `/api/inventory/barang/stock`.
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
      return ApiErrors.badRequest(
        "Pilih barang dan gudangnya dulu, baru stoknya bisa dilihat.",
      );
    }

    const bolehAkses = await inventoryRouteService.canAccessGudang({
      userId: session.user.id,
      gudangId,
      permissions: await getUserPermissions(session.user.id),
      isSuperAdmin: isSuperAdmin(session.user),
      restrictedPermissions: IZIN_PEMBATAS_BARANG,
    });
    if (!bolehAkses) return ApiErrors.forbidden(PESAN_GUDANG_BEDA_SITE);

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
    return ApiErrors.internalError(pesanGagalMuat("stok per kondisi"));
  }
}
