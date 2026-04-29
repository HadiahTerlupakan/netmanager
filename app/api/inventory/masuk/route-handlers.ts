import { logger } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryMasukRouteService,
  type InventoryMasukRouteResult,
  logInventoryStockInEffects,
  buildInventoryAccessSession,
  validateGudangSiteAccess,
} from "@/modules/inventory";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { parsePaginationParams } from "@/lib/utils/pagination";

type InventoryMasukRouteFailure = Extract<
  InventoryMasukRouteResult<unknown>,
  { success: false }
>;

type CreatedMasukPayload = {
  masukRecord: { id: string } & Record<string, unknown>;
  finalStock: number;
  parsedJumlah: number;
};

function isInventoryMasukRouteFailure(
  result: InventoryMasukRouteResult<unknown>,
): result is InventoryMasukRouteFailure {
  return !result.success;
}

async function ensureReadPermission() {
  if (await hasPermission("masuk:read")) return null;
  return ApiErrors.forbidden(
    "Anda tidak memiliki akses untuk melihat barang masuk",
  );
}

async function ensureCreatePermission() {
  if (await hasPermission("masuk:create")) return null;
  return ApiErrors.forbidden(
    "Anda tidak memiliki akses untuk membuat barang masuk",
  );
}

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

async function validateCreateAccess(user: { id: string }, gudangId: string) {
  const accessSession = await buildInventoryAccessSession(user);
  return validateGudangSiteAccess(accessSession, gudangId);
}

function toCreatedMasukPayload(
  result: Extract<InventoryMasukRouteResult<unknown>, { success: true }>,
) {
  return result.data as CreatedMasukPayload;
}

function mapCreateMasukError(error: Error) {
  if (error.message === "Barang tidak ditemukan")
    return ApiErrors.notFound("Barang");
  if (error.message === "Gudang tidak ditemukan atau tidak aktif") {
    return ApiErrors.badRequest("Gudang tidak ditemukan atau tidak aktif");
  }
  return ApiErrors.internalError("Gagal mencatat barang masuk");
}

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const denied = await ensureReadPermission();
  if (denied) return denied;

  try {
    const input = await buildListInput(req, user.id, isSuperAdmin(user));
    const dbStart = Date.now();
    const result = await inventoryMasukRouteService.listMasuk(input);

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
        count: result.masukList.length,
        page: input.page,
        limit: input.limit,
        total: result.pagination.total,
        barangId: input.barangId,
        gudangId: input.gudangId,
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

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const denied = await ensureCreatePermission();
  if (denied) return denied;

  const body = await req.json();
  const access = await validateCreateAccess(user, body.gudangId);
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

    const payload = toCreatedMasukPayload(result);
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
        barangId: body.barangId,
        gudangId: body.gudangId,
        jumlah: payload.parsedJumlah,
        masukId: payload.masukRecord.id,
      },
    );

    await logInventoryStockInEffects({
      userId: user.id,
      barangId: body.barangId,
      gudangId: body.gudangId,
      parsedJumlah: payload.parsedJumlah,
      finalStock: payload.finalStock,
      masukRecord: payload.masukRecord,
    });

    return apiSuccess(
      {
        message: "Barang masuk berhasil dicatat",
        masukId: payload.masukRecord.id,
        data: payload.masukRecord,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating barang masuk", err, {
      path: "/api/inventory/masuk",
      method: "POST",
    });
    return mapCreateMasukError(err);
  }
});
