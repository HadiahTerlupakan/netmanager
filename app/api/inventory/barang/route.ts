import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryBarangRouteService,
  type InventoryBarangRouteResult,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { parsePaginationParams } from "@/lib/constants/pagination";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

type InventoryBarangRouteFailure<T> = Extract<
  InventoryBarangRouteResult<T>,
  { success: false }
>;

function isInventoryBarangRouteFailure<T>(
  result: InventoryBarangRouteResult<T>,
): result is InventoryBarangRouteFailure<T> {
  return !result.success;
}

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("barang:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat barang",
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const gudangId = searchParams.get("gudangId");
  const search = searchParams.get("search");
  const { page, limit } = parsePaginationParams(searchParams, {
    page: 1,
    limit: 10,
  });

  try {
    const dbStart = Date.now();

    const permissions = await getUserPermissions(user.id);
    const result = await inventoryBarangRouteService.listBarang({
      userId: user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(user),
      search,
      gudangId,
      page,
      limit,
    });

    logger.dbOperation("findMany", "Barang+BarangGudang", Date.now() - dbStart);

    logger.apiRequest(
      "GET",
      "/api/inventory/barang",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        barangCount: result.barangs.length,
        page,
        limit,
        total: result.pagination.total,
        gudangId,
        search,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching barangs", err, {
      path: "/api/inventory/barang",
      method: "GET",
    });
    throw error; // Let createHandler handle it
  }
});

/**
 * POST /api/inventory/barang
 * Create new item
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("barang:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat barang",
    );
  }

  const body = await req.json();

  try {
    const dbStart = Date.now();
    const result = await inventoryBarangRouteService.createBarang({
      userId: user.id,
      body,
    });

    if (isInventoryBarangRouteFailure(result)) {
      return ApiErrors.badRequest(result.error);
    }

    logger.dbOperation("create", "Barang", Date.now() - dbStart);

    logger.apiRequest(
      "POST",
      "/api/inventory/barang",
      201,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId: result.data.barang.id,
        kode: result.data.barang.kode,
      },
    );

    return apiSuccess(result.data, {
      status: 201,
      message: result.message,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating barang", err, {
      path: "/api/inventory/barang",
      method: "POST",
    });
    const message =
      error instanceof Error ? error.message : "Gagal membuat barang";
    return ApiErrors.internalError(message);
  }
});
