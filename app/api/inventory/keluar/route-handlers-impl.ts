import { logger } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryKeluarRouteService,
  type InventoryKeluarRouteResult,
  logInventoryStockOutEffects,
} from "@/modules/inventory";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { parsePaginationParams } from "@/lib/utils/pagination";
import {
  INVENTORY_UNEXPECTED_ERROR_MESSAGE,
  inventoryFailureResponse,
} from "../_lib/inventory-failure-response";
import {
  ensureCreateGudangAccess,
  parseInventoryMutationBody,
} from "../_lib/inventory-mutation-request";

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

/** Map create keluar payload from route service result. */
function toCreatedKeluarPayload(
  result: Extract<InventoryKeluarRouteResult<unknown>, { success: true }>,
) {
  return result.data as CreatedKeluarPayload;
}

/** Handle stock breakdown request when requested by query flag. */
async function handleStockBreakdown(
  searchParams: URLSearchParams,
  user: { id: string; role?: string; isSuperAdmin?: boolean },
  permissions: string[],
) {
  const barangId = searchParams.get("barangId");
  const gudangId = searchParams.get("gudangId");
  if (!searchParams.has("checkStock") || !barangId || !gudangId) return null;

  try {
    const result = await inventoryKeluarRouteService.getStockBreakdown({
      barangId,
      gudangId,
      userId: user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(user),
    });
    if (isInventoryKeluarRouteFailure(result)) {
      return inventoryFailureResponse(result);
    }
    return apiSuccess(result.data);
  } catch (error: unknown) {
    logger.error(
      "Error checking stock breakdown",
      error instanceof Error ? error : new Error(String(error)),
      { path: "/api/inventory/keluar", method: "GET" },
    );
    return ApiErrors.internalError(
      "Sisa stok barang ini gagal dicek karena ada gangguan di server. Pilih barangnya lagi. Kalau tetap gagal, laporkan ke admin.",
    );
  }
}

/** Handle list barang keluar request. */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  if (!(await hasPermission("keluar:read"))) {
    return ApiErrors.forbidden(
      "Akun Anda tidak punya izin melihat barang keluar. Minta admin menambahkan izin ini ke peran Anda.",
    );
  }

  const stockBreakdownResponse = await handleStockBreakdown(
    req.nextUrl.searchParams,
    user,
    ctx.permissions,
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
    return ApiErrors.internalError(
      "Daftar barang keluar gagal dimuat karena ada gangguan di server. Muat ulang halaman. Kalau tetap gagal, laporkan ke admin.",
    );
  }
});

/** Handle create barang keluar request. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  if (!(await hasPermission("keluar:create"))) {
    return ApiErrors.forbidden(
      "Akun Anda tidak punya izin mencatat barang keluar. Minta admin menambahkan izin ini ke peran Anda.",
    );
  }

  const parsed = await parseInventoryMutationBody(req);
  if (parsed.ok === false) return parsed.response;
  const body = parsed.body;

  const gudangDenied = await ensureCreateGudangAccess(ctx, body, "keluar");
  if (gudangDenied) return gudangDenied;

  try {
    const dbStart = Date.now();
    const result = await inventoryKeluarRouteService.createKeluar({
      userId: user.id,
      tenantId: user.tenantId,
      body,
    });
    if (isInventoryKeluarRouteFailure(result)) {
      return inventoryFailureResponse(result);
    }

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
      barangId: String(body.barangId),
      gudangId: String(body.gudangId),
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
    return ApiErrors.internalError(INVENTORY_UNEXPECTED_ERROR_MESSAGE);
  }
});
