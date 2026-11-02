import { NextRequest } from "next/server";
import { verifyAuth, getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  getInventoryRouteService,
  PESAN_BELUM_MASUK,
  pesanGagalMuat,
  pesanTanpaIzin,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { toStartOfDay } from "@/lib/utils/server-datetime";

const inventoryRouteService = getInventoryRouteService();

export const dynamic = "force-dynamic";

/** Ambil statistik inventory untuk user yang sedang login. */
export async function GET(req: NextRequest) {
  const session = await verifyAuth(req);
  if (!session) {
    return ApiErrors.unauthorized(PESAN_BELUM_MASUK);
  }

  // Permission check
  if (!(await hasPermission("barang:read"))) {
    return ApiErrors.forbidden(pesanTanpaIzin("melihat statistik gudang"));
  }

  try {
    const startOfDay = new Date();
    startOfDay.setTime(toStartOfDay(startOfDay).getTime());
    const stats = await inventoryRouteService.getInventoryStats({
      pengguna: {
        userId: session.id,
        permissions: await getUserPermissions(session.id),
        isSuperAdmin: isSuperAdmin(session),
      },
      startOfDay,
    });

    return apiSuccess(stats);
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching inventory stats:", err);
    return ApiErrors.internalError(pesanGagalMuat("statistik gudang"));
  }
}
