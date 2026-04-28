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

function isInventoryBarangRouteFailure(
  result: InventoryBarangRouteResult<unknown>,
): result is InventoryBarangRouteFailure {
  return !result.success;
}

/**
 * GET /api/inventory/barang/[id]
 * Get specific item by ID
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("barang:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat detail barang",
    );
  }

  const permissions = await getUserPermissions(user.id);
  const siteId = await inventoryRouteService.resolveRestrictedSiteId({
    userId: user.id,
    permissions,
    isSuperAdmin: isSuperAdmin(user),
    restrictedPermissions: [
      "barang:site_only",
      "k_barang:site_only",
      "gudang:site_only",
    ],
  });

  try {
    const dbStart = Date.now();

    const result = await inventoryBarangRouteService.getBarangDetail({
      id,
      siteId,
    });

    if (!result.found) {
      return ApiErrors.notFound("Barang");
    }

    const barangWithStats = result.barang;

    logger.dbOperation("findUnique", "Barang+Relations", Date.now() - dbStart);

    logger.apiRequest(
      "GET",
      `/api/inventory/barang/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId: barangWithStats.id,
      },
    );

    return apiSuccess({ barang: barangWithStats });
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

/**
 * PUT /api/inventory/barang/[id]
 * Update specific item
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("barang:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah barang",
    );
  }

  const body = await req.json();
  const { kode, nama, satuan } = body;

  const permissions = await getUserPermissions(user.id);
  const siteId = await inventoryRouteService.resolveRestrictedSiteId({
    userId: user.id,
    permissions,
    isSuperAdmin: isSuperAdmin(user),
    restrictedPermissions: [
      "barang:site_only",
      "k_barang:site_only",
      "gudang:site_only",
    ],
  });

  try {
    const dbStart = Date.now();

    const result = await inventoryBarangRouteService.updateBarang({
      id,
      siteId,
      body,
    });

    if (isInventoryBarangRouteFailure(result)) {
      if (result.status === 403) return ApiErrors.forbidden(result.error);
      if (result.status === 404) return ApiErrors.notFound("Barang");
      return ApiErrors.badRequest(result.error);
    }

    const updatedBarang = result.data as { id: string };

    logger.dbOperation("update", "Barang", Date.now() - dbStart);

    logger.apiRequest(
      "PUT",
      `/api/inventory/barang/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId: updatedBarang.id,
      },
    );

    // System Log
    await logger.logActivity({
      action: "UPDATE",
      subject: "Barang",
      userId: user.id,
      details: { id: updatedBarang.id, changes: { kode, nama, satuan } },
    });

    return apiSuccess({ barang: updatedBarang }, { message: result.message });
  } catch (error) {
    const err = error as Error;
    logger.error("Error updating barang", err, {
      path: "/api/inventory/barang/[id]",
      method: "PUT",
      id: "unknown",
    });
    if (
      err.message === "Barang tidak ditemukan" ||
      err.message ===
        "Satuan barang tidak boleh diubah saat stok masih tersedia"
    ) {
      return ApiErrors.badRequest(err.message);
    }
    return ApiErrors.internalError("Gagal mengupdate barang");
  }
});

/**
 * DELETE /api/inventory/barang/[id]
 * Delete specific item
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const { id } = ctx.params;

  if (!(await hasPermission("barang:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus barang",
    );
  }

  const permissions = await getUserPermissions(user.id);
  const siteId = await inventoryRouteService.resolveRestrictedSiteId({
    userId: user.id,
    permissions,
    isSuperAdmin: isSuperAdmin(user),
    restrictedPermissions: [
      "barang:site_only",
      "k_barang:site_only",
      "gudang:site_only",
    ],
  });

  try {
    const dbStart = Date.now();

    const result = await inventoryBarangRouteService.deleteBarang({
      id,
      siteId,
    });

    if (isInventoryBarangRouteFailure(result)) {
      if (result.status === 403) return ApiErrors.forbidden(result.error);
      if (result.status === 404) return ApiErrors.notFound("Barang");
      return ApiErrors.badRequest(result.error);
    }

    logger.dbOperation("delete", "Barang", Date.now() - dbStart);

    logger.apiRequest(
      "DELETE",
      `/api/inventory/barang/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId: id,
      },
    );

    // System Log
    await logger.logActivity({
      action: "DELETE",
      subject: "Barang",
      userId: user.id,
      details: { id },
    });

    return apiSuccess(null, { message: result.message });
  } catch (error) {
    const err = error as Error;

    // Check for Prisma Foreign Key Constraint error (P2003)
    if (
      (error as { code?: string }).code === "P2003" ||
      err.message?.includes("P2003")
    ) {
      return ApiErrors.badRequest(
        "Barang tidak bisa dihapus karena masih terkait dengan data transaksi (Work Order, Pesanan, atau Aset). Pastikan semua relasi data terkait sudah dibersihkan.",
      );
    }

    logger.error("Error deleting barang", err, {
      path: "/api/inventory/barang/[id]",
      method: "DELETE",
      id: "unknown",
    });
    return ApiErrors.internalError("Gagal menghapus barang");
  }
});
