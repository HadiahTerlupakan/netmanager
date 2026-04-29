import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  getInventoryRouteService,
  inventoryBarangRouteService,
} from "@/modules/inventory";
import type { InventoryBarangRouteResult } from "@/modules/inventory";

type InventoryBarangRouteFailure = Extract<
  InventoryBarangRouteResult<unknown>,
  { success: false }
>;

const inventoryRouteService = getInventoryRouteService();
const SITE_RESTRICTION_PERMISSIONS = [
  "barang:site_only",
  "k_barang:site_only",
  "gudang:site_only",
];

/** Check whether inventory barang route service returned a failure. */
function isInventoryBarangRouteFailure(
  result: InventoryBarangRouteResult<unknown>,
): result is InventoryBarangRouteFailure {
  return !result.success;
}

/** Resolve restricted site id for current user. */
async function resolveRestrictedSiteId(user: {
  id: string;
  role?: string;
  isSuperAdmin?: boolean;
}) {
  const permissions = await getUserPermissions(user.id);
  return inventoryRouteService.resolveRestrictedSiteId({
    userId: user.id,
    permissions,
    isSuperAdmin: isSuperAdmin(user),
    restrictedPermissions: SITE_RESTRICTION_PERMISSIONS,
  });
}

/** Map route failure into API response. */
function mapBarangRouteFailure(result: InventoryBarangRouteFailure) {
  if (result.status === 403) return ApiErrors.forbidden(result.error);
  if (result.status === 404) return ApiErrors.notFound("Barang");
  return ApiErrors.badRequest(result.error);
}

/** Map update error into API response. */
function mapUpdateBarangError(error: Error) {
  if (
    error.message === "Barang tidak ditemukan" ||
    error.message ===
      "Satuan barang tidak boleh diubah saat stok masih tersedia"
  ) {
    return ApiErrors.badRequest(error.message);
  }

  return ApiErrors.internalError("Gagal mengupdate barang");
}

/** Map delete error into API response. */
function mapDeleteBarangError(error: Error & { code?: string }) {
  if (error.code === "P2003" || error.message?.includes("P2003")) {
    return ApiErrors.badRequest(
      "Barang tidak bisa dihapus karena masih terkait dengan data transaksi (Work Order, Pesanan, atau Aset). Pastikan semua relasi data terkait sudah dibersihkan.",
    );
  }

  return ApiErrors.internalError("Gagal menghapus barang");
}

/** Log successful barang request. */
function logBarangRequest(
  method: string,
  path: string,
  startTime: number,
  meta: Record<string, unknown>,
) {
  logger.apiRequest(method, path, 200, Date.now() - startTime, meta);
}

/** Handle get barang detail request. */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("barang:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat detail barang",
    );
  }

  try {
    const siteId = await resolveRestrictedSiteId(user);
    const dbStart = Date.now();
    const result = await inventoryBarangRouteService.getBarangDetail({
      id,
      siteId,
    });

    if (!result.found) {
      return ApiErrors.notFound("Barang");
    }

    logger.dbOperation("findUnique", "Barang+Relations", Date.now() - dbStart);
    logBarangRequest("GET", `/api/inventory/barang/${id}`, startTime, {
      userId: user.id,
      barangId: result.barang.id,
    });

    return apiSuccess({ barang: result.barang });
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching barang", err, {
      path: "/api/inventory/barang/[id]",
      method: "GET",
      id: "unknown",
    });
    return ApiErrors.internalError("Gagal memuat data barang");
  }
});

/** Handle update barang request. */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("barang:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah barang",
    );
  }

  try {
    const body = await req.json();
    const siteId = await resolveRestrictedSiteId(user);
    const dbStart = Date.now();
    const result = await inventoryBarangRouteService.updateBarang({
      id,
      siteId,
      body,
    });

    if (isInventoryBarangRouteFailure(result)) {
      return mapBarangRouteFailure(result);
    }

    const updatedBarang = result.data as { id: string };
    logger.dbOperation("update", "Barang", Date.now() - dbStart);
    logBarangRequest("PUT", `/api/inventory/barang/${id}`, startTime, {
      userId: user.id,
      barangId: updatedBarang.id,
    });

    await logger.logActivity({
      action: "UPDATE",
      subject: "Barang",
      userId: user.id,
      details: {
        id: updatedBarang.id,
        changes: {
          kode: body.kode,
          nama: body.nama,
          satuan: body.satuan,
        },
      },
    });

    return apiSuccess({ barang: updatedBarang }, { message: result.message });
  } catch (error) {
    const err = error as Error;
    logger.error("Error updating barang", err, {
      path: "/api/inventory/barang/[id]",
      method: "PUT",
      id: "unknown",
    });
    return mapUpdateBarangError(err);
  }
});

/** Handle delete barang request. */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("barang:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus barang",
    );
  }

  try {
    const siteId = await resolveRestrictedSiteId(user);
    const dbStart = Date.now();
    const result = await inventoryBarangRouteService.deleteBarang({
      id,
      siteId,
    });

    if (isInventoryBarangRouteFailure(result)) {
      return mapBarangRouteFailure(result);
    }

    logger.dbOperation("delete", "Barang", Date.now() - dbStart);
    logBarangRequest("DELETE", `/api/inventory/barang/${id}`, startTime, {
      userId: user.id,
      barangId: id,
    });

    await logger.logActivity({
      action: "DELETE",
      subject: "Barang",
      userId: user.id,
      details: { id },
    });

    return apiSuccess(null, { message: result.message });
  } catch (error) {
    const err = error as Error & { code?: string };
    logger.error("Error deleting barang", err, {
      path: "/api/inventory/barang/[id]",
      method: "DELETE",
      id: "unknown",
    });
    return mapDeleteBarangError(err);
  }
});
