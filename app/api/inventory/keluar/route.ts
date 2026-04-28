import { logger } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryKeluarRouteService,
  type InventoryKeluarRouteResult,
} from "@/modules/inventory";
import { logActivitySafe } from "@/lib/logger";
import {
  buildInventoryAccessSession,
  validateGudangSiteAccess,
} from "@/lib/inventory/access-session";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { parsePaginationParams } from "@/lib/utils/pagination";

type InventoryKeluarRouteFailure = Extract<
  InventoryKeluarRouteResult<unknown>,
  { success: false }
>;

function isInventoryKeluarRouteFailure(
  result: InventoryKeluarRouteResult<unknown>,
): result is InventoryKeluarRouteFailure {
  return !result.success;
}

/**
 * @swagger
 * /api/inventory/keluar:
 *   get:
 *     summary: Get all stock-out movements with filters
 *     tags: [Inventory]
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("keluar:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat barang keluar",
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

  if (searchParams.has("checkStock") && barangId && gudangId) {
    try {
      return apiSuccess(
        await inventoryKeluarRouteService.getStockBreakdown(barangId, gudangId),
      );
    } catch (_error) {
      return ApiErrors.internalError("Gagal mengecek stok");
    }
  }

  try {
    const dbStart = Date.now();
    const result = await inventoryKeluarRouteService.listKeluar({
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
    const keluarList = result.keluarList;
    const total = result.pagination.total;

    logger.dbOperation(
      "findMany",
      "BarangKeluar+Relations",
      Date.now() - dbStart,
    );

    logger.apiRequest(
      "GET",
      "/api/inventory/keluar",
      200,
      Date.now() - startTime,
      {
        count: keluarList.length,
        page,
        limit,
        total,
        userId: user.id,
        barangId,
        gudangId,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching barang keluar", err, {
      path: "/api/inventory/keluar",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data barang keluar");
  }
});

/**
 * @swagger
 * /api/inventory/keluar:
 *   post:
 *     summary: Record new stock-out movement
 *     tags: [Inventory]
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("keluar:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat barang keluar",
    );
  }

  const body = await req.json();
  const { barangId, gudangId } = body;
  const finalEmployeeId = user.id;

  const accessSession = await buildInventoryAccessSession(user);
  const access = await validateGudangSiteAccess(accessSession, gudangId);
  if (!access.allowed) {
    return ApiErrors.forbidden(
      access.error || "Anda tidak memiliki akses ke gudang ini",
    );
  }

  try {
    const dbStart = Date.now();
    const result = await inventoryKeluarRouteService.createKeluar({
      userId: finalEmployeeId,
      body,
    });

    if (isInventoryKeluarRouteFailure(result)) {
      return ApiErrors.badRequest(result.error);
    }

    const { keluarRecord, finalStock, parsedJumlah } = result.data as {
      keluarRecord: { id: string } & Record<string, unknown>;
      finalStock: number;
      parsedJumlah: number;
    };

    logger.dbOperation(
      "transaction",
      "BarangKeluar+BarangGudang",
      Date.now() - dbStart,
    );

    logger.apiRequest(
      "POST",
      "/api/inventory/keluar",
      201,
      Date.now() - startTime,
      {
        barangId,
        gudangId,
        jumlah: parsedJumlah,
        keluarId: keluarRecord.id,
        newStock: finalStock,
        userId: user.id,
      },
    );

    // System Log
    logActivitySafe({
      action: "CREATE",
      subject: "Inventory Out",
      details: {
        id: keluarRecord.id,
        barangId,
        gudangId,
        quantity: parsedJumlah,
      },
      userId: user.id,
    });

    // Broadcast inventory update
    const { socketEmitter } = await import("@/lib/websocket/emitter");
    socketEmitter.inventoryUpdate({
      type: "keluar",
      userId: finalEmployeeId as string,
      barangId,
      gudangId,
      jumlah: parsedJumlah,
      totalStok: finalStock,
    });

    // Publish domain event
    const { InventoryEventDispatcher } = await import("@/modules/events");
    await InventoryEventDispatcher.onStockOut({
      barangId,
      barangName: (keluarRecord as Record<string, unknown>)?.barang
        ? ((
            (keluarRecord as Record<string, unknown>).barang as Record<
              string,
              unknown
            >
          )?.nama as string)
        : undefined,
      gudangId,
      jumlah: parsedJumlah,
      totalStok: finalStock,
      userId: (finalEmployeeId as string) || user.id,
    }).catch((err) =>
      logger.error(
        "Failed to publish INVENTORY_STOCK_OUT event",
        err instanceof Error ? err : undefined,
      ),
    );

    return apiSuccess(
      {
        message: "Barang keluar berhasil dicatat",
        keluarId: keluarRecord.id,
        data: keluarRecord,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating barang keluar", err, {
      path: "/api/inventory/keluar",
      method: "POST",
    });

    if (err.message === "Barang tidak ditemukan") {
      return ApiErrors.notFound("Barang");
    }
    if (err.message === "Gudang tidak ditemukan atau tidak aktif") {
      return ApiErrors.badRequest("Gudang tidak ditemukan atau tidak aktif");
    }
    if (
      err.message.includes("Stok tidak mencukupi") ||
      err.message.includes("tersedia")
    ) {
      return ApiErrors.badRequest(err.message);
    }

    return ApiErrors.internalError(
      err.message || "Gagal mencatat barang keluar",
    );
  }
});
