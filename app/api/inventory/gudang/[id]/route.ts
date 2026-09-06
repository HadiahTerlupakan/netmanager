import { logger } from "@/lib/logger";
import {
  inventoryGudangRouteService,
  type InventoryGudangRouteResult,
} from "@/modules/inventory";
import { logActivitySafe } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

type InventoryGudangRouteFailure = Extract<
  InventoryGudangRouteResult<unknown>,
  { success: false }
>;

function isInventoryGudangRouteFailure(
  result: InventoryGudangRouteResult<unknown>,
): result is InventoryGudangRouteFailure {
  return !result.success;
}

/**
 * GET /api/inventory/gudang/[id]
 * Get specific warehouse by ID
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const { id } = ctx.params;

  if (!(await hasPermission("gudang:read"))) {
    return ApiErrors.forbidden();
  }

  try {
    const dbStart = Date.now();
    const result = await inventoryGudangRouteService.getGudangDetail(id);

    if (!result.found) {
      return ApiErrors.notFound("Gudang");
    }

    const gudang = result.gudang;

    logger.dbOperation("findUnique", "Gudang", Date.now() - dbStart);

    logger.apiRequest(
      "GET",
      `/api/inventory/gudang/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: ctx.session!.user.id,
        gudangId: gudang.id,
      },
    );

    return apiSuccess({ gudang });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error fetching gudang", err, {
      path: "/api/inventory/gudang/[id]",
      method: "GET",
      id: "unknown",
    });
    return ApiErrors.internalError("Gagal memuat data gudang");
  }
});

/**
 * PUT /api/inventory/gudang/[id]
 * Update specific warehouse
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const { id } = ctx.params;
  const startTime = Date.now();

  if (!(await hasPermission("gudang:update"))) {
    return ApiErrors.forbidden();
  }
  const body = await req.json();
  const { kode, nama, lokasi, isActive } = body;

  try {
    const dbStart = Date.now();
    const result = await inventoryGudangRouteService.updateGudang({ id, body });

    if (isInventoryGudangRouteFailure(result)) {
      if (result.status === 404) return ApiErrors.notFound("Gudang");
      return ApiErrors.badRequest(result.error);
    }

    const updatedGudang = result.data as { id: string };

    logger.dbOperation("update", "Gudang", Date.now() - dbStart);

    logger.apiRequest(
      "PUT",
      `/api/inventory/gudang/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: ctx.session!.user.id,
        gudangId: updatedGudang.id,
      },
    );

    // System Log
    logActivitySafe({
      action: "UPDATE",
      subject: "Gudang",
      userId: ctx.session!.user.id,
      details: {
        id: updatedGudang.id,
        updates: { kode, nama, lokasi, isActive },
      },
    });

    return apiSuccess({ gudang: updatedGudang });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error updating gudang", err, {
      path: "/api/inventory/gudang/[id]",
      method: "PUT",
      id: "unknown",
    });
    return ApiErrors.internalError("Gagal mengupdate gudang");
  }
});

/**
 * DELETE /api/inventory/gudang/[id]
 * Delete specific warehouse (hard delete)
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const { id } = ctx.params;
  const startTime = Date.now();

  if (!(await hasPermission("gudang:delete"))) {
    return ApiErrors.forbidden();
  }

  try {
    const dbStart = Date.now();
    const result = await inventoryGudangRouteService.deleteGudang(id);

    if (isInventoryGudangRouteFailure(result)) {
      if (result.status === 404) return ApiErrors.notFound("Gudang");
      return ApiErrors.badRequest(result.error);
    }

    logger.dbOperation("update", "Gudang", Date.now() - dbStart);

    logger.apiRequest(
      "DELETE",
      `/api/inventory/gudang/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: ctx.session!.user.id,
        gudangId: id,
      },
    );

    // System Log
    logActivitySafe({
      action: "DELETE",
      subject: "Gudang",
      userId: ctx.session!.user.id,
      details: { id },
    });

    return apiSuccess({ message: "Gudang berhasil dihapus" });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Check for Prisma Foreign Key Constraint error (P2003)
    if (
      (error as { code?: string }).code === "P2003" ||
      err.message?.includes("P2003")
    ) {
      return ApiErrors.badRequest(
        "Gudang tidak dapat dihapus karena masih terelasi dengan data Transaksi (Barang Masuk/Keluar, Transfer, dsb). Pastikan gudang tersebut kosong dan tidak ada riwayat transaksi yang mengikat.",
      );
    }

    logger.error("Error deleting gudang", err, {
      path: "/api/inventory/gudang/[id]",
      method: "DELETE",
      id: id ?? "unknown",
    });
    return ApiErrors.internalError("Gagal menghapus gudang");
  }
});
