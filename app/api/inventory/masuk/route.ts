import { logger } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryMasukRouteService,
  type InventoryMasukRouteResult,
} from "@/modules/inventory";
import { logActivitySafe } from "@/lib/logger";
import {
  buildInventoryAccessSession,
  validateGudangSiteAccess,
} from "@/modules/inventory";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { parsePaginationParams } from "@/lib/utils/pagination";

type InventoryMasukRouteFailure = Extract<
  InventoryMasukRouteResult<unknown>,
  { success: false }
>;

function isInventoryMasukRouteFailure(
  result: InventoryMasukRouteResult<unknown>,
): result is InventoryMasukRouteFailure {
  return !result.success;
}

/**
 * @swagger
 * /api/inventory/masuk:
 *   get:
 *     summary: Get all stock-in movements with filters
 *     tags: [Inventory]
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("masuk:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat barang masuk",
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const barangId = searchParams.get("barangId") || undefined;
  const gudangId = searchParams.get("gudangId") || undefined;
  const search = searchParams.get("search") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  const { page, limit } = parsePaginationParams(searchParams, {
    page: 1,
    limit: 20,
  });
  const permissions = await getUserPermissions(user.id);

  try {
    const dbStart = Date.now();
    const result = await inventoryMasukRouteService.listMasuk({
      userId: user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(user),
      page,
      limit,
      barangId,
      gudangId,
      search,
      siteId,
    });
    const masukList = result.masukList;
    const total = result.pagination.total;

    logger.dbOperation(
      "findMany",
      "BarangMasuk+Relations",
      Date.now() - dbStart,
    );

    logger.apiRequest(
      "GET",
      "/api/inventory/masuk",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        count: masukList.length,
        page,
        limit,
        total,
        barangId,
        gudangId,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching barang masuk", err, {
      path: "/api/inventory/masuk",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data barang masuk");
  }
});

/**
 * @swagger
 * /api/inventory/masuk:
 *   post:
 *     summary: Record new stock-in movement
 *     tags: [Inventory]
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("masuk:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat barang masuk",
    );
  }

  const body = await req.json();
  const { barangId, gudangId } = body;

  const accessSession = await buildInventoryAccessSession(user);
  const access = await validateGudangSiteAccess(accessSession, gudangId);
  if (!access.allowed) {
    return ApiErrors.forbidden(
      access.error || "Anda tidak memiliki akses ke gudang ini",
    );
  }

  try {
    const dbStart = Date.now();
    const result = await inventoryMasukRouteService.createMasuk({
      userId: user.id,
      body,
    });

    if (isInventoryMasukRouteFailure(result)) {
      return ApiErrors.badRequest(result.error);
    }

    const { masukRecord, finalStock, parsedJumlah } = result.data as {
      masukRecord: { id: string } & Record<string, unknown>;
      finalStock: number;
      parsedJumlah: number;
    };

    logger.dbOperation(
      "transaction",
      "BarangMasuk+BarangGudang",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "POST",
      "/api/inventory/masuk",
      201,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId,
        gudangId,
        jumlah: parsedJumlah,
        masukId: masukRecord.id,
      },
    );

    // System Log
    logActivitySafe({
      action: "CREATE",
      subject: "Inventory In",
      userId: user.id,
      details: {
        id: masukRecord.id,
        barangId,
        gudangId,
        quantity: parsedJumlah,
      },
    });

    // Broadcast inventory update
    const { socketEmitter } = await import("@/lib/websocket/emitter");
    socketEmitter.inventoryUpdate({
      type: "masuk",
      userId: user.id,
      barangId,
      gudangId,
      jumlah: parsedJumlah,
      totalStok: finalStock,
    });

    // Publish domain event
    const { InventoryEventDispatcher } = await import("@/modules/events");
    await InventoryEventDispatcher.onStockIn({
      barangId,
      barangName: (masukRecord as Record<string, unknown>)?.barang
        ? ((
            (masukRecord as Record<string, unknown>).barang as Record<
              string,
              unknown
            >
          )?.nama as string)
        : undefined,
      gudangId,
      jumlah: parsedJumlah,
      totalStok: finalStock,
      userId: user.id,
    }).catch((err) =>
      logger.error(
        "Failed to publish INVENTORY_STOCK_IN event",
        err instanceof Error ? err : undefined,
      ),
    );

    return apiSuccess(
      {
        message: "Barang masuk berhasil dicatat",
        masukId: masukRecord.id,
        data: masukRecord,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating barang masuk", err, {
      path: "/api/inventory/masuk",
      method: "POST",
    });

    if (err.message === "Barang tidak ditemukan") {
      return ApiErrors.notFound("Barang");
    }
    if (err.message === "Gudang tidak ditemukan atau tidak aktif") {
      return ApiErrors.badRequest("Gudang tidak ditemukan atau tidak aktif");
    }

    return ApiErrors.internalError("Gagal mencatat barang masuk");
  }
});
