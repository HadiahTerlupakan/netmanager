import { logger } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryKeluarRouteService,
  type InventoryKeluarRouteResult,
  logInventoryStockOutEffects,
  buildInventoryAccessSession,
  validateGudangSiteAccess,
} from "@/modules/inventory";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { parsePaginationParams } from "@/lib/utils/pagination";

type InventoryKeluarRouteFailure = Extract<
  InventoryKeluarRouteResult<unknown>,
  { success: false }
>;

type CreatedKeluarPayload = {
  keluarRecord: { id: string } & Record<string, unknown>;
  finalStock: number;
  parsedJumlah: number;
};

/** Check whether inventory keluar route service returned a failure. */
function isInventoryKeluarRouteFailure(
  result: InventoryKeluarRouteResult<unknown>,
): result is InventoryKeluarRouteFailure {
  return !result.success;
}

/** Build list input from request and user context. */
async function buildListInput(
  req: Request & { nextUrl: URL },
  userId: string,
  isUserSuperAdmin: boolean,
) {
  const searchParams = req.nextUrl.searchParams;
  const { page, limit } = parsePaginationParams(searchParams, {
    page: 1,
    limit: 20,
  });

  return {
    userId,
    permissions: await getUserPermissions(userId),
    isSuperAdmin: isUserSuperAdmin,
    page,
    limit,
    barangId: searchParams.get("barangId") || undefined,
    gudangId: searchParams.get("gudangId") || undefined,
    search: searchParams.get("search") || undefined,
    siteId: searchParams.get("siteId") || undefined,
  };
}

/** Validate warehouse access for stock-out create flow. */
async function validateCreateAccess(user: { id: string }, gudangId: string) {
  const accessSession = await buildInventoryAccessSession(user);
  return validateGudangSiteAccess(accessSession, gudangId);
}

/** Map create keluar payload from route service result. */
function toCreatedKeluarPayload(
  result: Extract<InventoryKeluarRouteResult<unknown>, { success: true }>,
) {
  return result.data as CreatedKeluarPayload;
}

/** Map route create errors into API responses. */
function mapCreateKeluarError(error: Error) {
  if (error.message === "Barang tidak ditemukan")
    return ApiErrors.notFound("Barang");
  if (error.message === "Gudang tidak ditemukan atau tidak aktif") {
    return ApiErrors.badRequest("Gudang tidak ditemukan atau tidak aktif");
  }
  if (
    error.message.includes("Stok tidak mencukupi") ||
    error.message.includes("tersedia")
  ) {
    return ApiErrors.badRequest(error.message);
  }
  return ApiErrors.internalError(
    error.message || "Gagal mencatat barang keluar",
  );
}

/** Handle stock breakdown request when requested by query flag. */
async function handleStockBreakdown(searchParams: URLSearchParams) {
  const barangId = searchParams.get("barangId");
  const gudangId = searchParams.get("gudangId");
  if (!searchParams.has("checkStock") || !barangId || !gudangId) return null;

  try {
    return apiSuccess(
      await inventoryKeluarRouteService.getStockBreakdown(barangId, gudangId),
    );
  } catch {
    return ApiErrors.internalError("Gagal mengecek stok");
  }
}

/** Handle list barang keluar request. */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  if (!(await hasPermission("keluar:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat barang keluar",
    );
  }

  const stockBreakdownResponse = await handleStockBreakdown(
    req.nextUrl.searchParams,
  );
  if (stockBreakdownResponse) return stockBreakdownResponse;

  try {
    const input = await buildListInput(req, user.id, isSuperAdmin(user));
    const dbStart = Date.now();
    const result = await inventoryKeluarRouteService.listKeluar(input);

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
        count: result.keluarList.length,
        page: input.page,
        limit: input.limit,
        total: result.pagination.total,
        userId: user.id,
        barangId: input.barangId,
        gudangId: input.gudangId,
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

/** Handle create barang keluar request. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  if (!(await hasPermission("keluar:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat barang keluar",
    );
  }

  const body = await req.json();
  const access = await validateCreateAccess(user, body.gudangId);
  if (!access.allowed) {
    return ApiErrors.forbidden(
      access.error || "Anda tidak memiliki akses ke gudang ini",
    );
  }

  try {
    const dbStart = Date.now();
    const result = await inventoryKeluarRouteService.createKeluar({
      userId: user.id,
      tenantId: user.tenantId,
      body,
    });
    if (isInventoryKeluarRouteFailure(result))
      return ApiErrors.badRequest(result.error);

    const payload = toCreatedKeluarPayload(result);
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
        barangId: body.barangId,
        gudangId: body.gudangId,
        jumlah: payload.parsedJumlah,
        keluarId: payload.keluarRecord.id,
        newStock: payload.finalStock,
        userId: user.id,
      },
    );

    await logInventoryStockOutEffects({
      userId: user.id,
      barangId: body.barangId,
      gudangId: body.gudangId,
      parsedJumlah: payload.parsedJumlah,
      finalStock: payload.finalStock,
      keluarRecord: payload.keluarRecord,
    });

    return apiSuccess(
      {
        message: "Barang keluar berhasil dicatat",
        keluarId: payload.keluarRecord.id,
        data: payload.keluarRecord,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating barang keluar", err, {
      path: "/api/inventory/keluar",
      method: "POST",
    });
    return mapCreateKeluarError(err);
  }
});
