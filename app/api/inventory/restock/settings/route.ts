import { hasPermission } from "@/lib/rbac";
import { getInventoryRouteService } from "@/modules/inventory";
import { logger, logActivitySafe } from "@/lib/logger";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

const inventoryRouteService = getInventoryRouteService();

/**
 * GET /api/inventory/restock/settings
 * Get all restock settings
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat pengaturan restock",
    );
  }

  const { searchParams } = req.nextUrl;
  const barangId = searchParams.get("barangId") || undefined;
  const gudangId = searchParams.get("gudangId") || undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  try {
    const dbStart = Date.now();

    const result = await inventoryRouteService.getRestockSettings({
      barangId,
      gudangId,
      page,
      limit,
    });

    logger.dbOperation(
      "findMany",
      "RestockSettings+Relations",
      Date.now() - dbStart,
    );

    logger.apiRequest(
      "GET",
      "/api/inventory/restock/settings",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        count: result.settings.length,
        page,
        limit,
        total: result.pagination.total,
        barangId,
        gudangId,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching restock settings", err, {
      path: "/api/inventory/restock/settings",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat pengaturan restock");
  }
});

/**
 * POST /api/inventory/restock/settings
 * Create or update restock settings
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah pengaturan restock",
    );
  }

  const body = await req.json();
  const { barangId, gudangId, minStok, maxStok, safetyStok, leadTimeDays } =
    body;

  // Validation
  if (!barangId || !gudangId || !minStok || !maxStok) {
    return ApiErrors.badRequest(
      "Barang, gudang, minimal stok, dan maksimal stok harus diisi",
    );
  }

  if (minStok >= maxStok) {
    return ApiErrors.badRequest(
      "Minimal stok harus lebih kecil dari maksimal stok",
    );
  }

  try {
    const dbStart = Date.now();

    const result = await inventoryRouteService.saveRestockSettings({
      barangId,
      gudangId,
      minStok,
      maxStok,
      safetyStok,
      leadTimeDays,
    });

    logger.dbOperation(
      "transaction",
      "RestockSettings+Alerts",
      Date.now() - dbStart,
    );

    logger.apiRequest(
      "POST",
      "/api/inventory/restock/settings",
      201,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId,
        gudangId,
        minStok,
        maxStok,
      },
    );

    // System Log
    logActivitySafe({
      action: "UPDATE",
      subject: "Restock Settings",
      userId: user.id,
      details: { barangId, gudangId, minStok, maxStok },
    });

    return apiSuccess(
      {
        message: "Pengaturan restock berhasil disimpan",
        settings: result,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error saving restock settings", err, {
      path: "/api/inventory/restock/settings",
      method: "POST",
    });

    if (err.message === "Barang tidak ditemukan") {
      return ApiErrors.notFound("Barang");
    }
    if (err.message === "Gudang tidak ditemukan atau tidak aktif") {
      return ApiErrors.badRequest("Gudang tidak ditemukan atau tidak aktif");
    }

    return ApiErrors.internalError("Gagal menyimpan pengaturan restock");
  }
});
