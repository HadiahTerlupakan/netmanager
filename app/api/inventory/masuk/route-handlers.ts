import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryMasukRouteService,
  logInventoryStockInEffects,
  type InventoryMasukRouteResult,
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

type CreatedMasukPayload = {
  masukRecord: { id: string } & Record<string, unknown>;
  finalStock: number;
  parsedJumlah: number;
};
function isInventoryMasukRouteFailure(
  result: InventoryMasukRouteResult<unknown>,
): result is Extract<InventoryMasukRouteResult<unknown>, { success: false }> {
  return !result.success;
}

async function ensureReadPermission() {
  if (await hasPermission("masuk:read")) return null;
  return ApiErrors.forbidden(
    "Akun Anda tidak punya izin melihat barang masuk. Minta admin menambahkan izin ini ke peran Anda.",
  );
}

async function ensureCreatePermission() {
  if (await hasPermission("masuk:create")) return null;
  return ApiErrors.forbidden(
    "Akun Anda tidak punya izin mencatat barang masuk. Minta admin menambahkan izin ini ke peran Anda.",
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

function toCreatedMasukPayload(
  result: Extract<InventoryMasukRouteResult<unknown>, { success: true }>,
) {
  return result.data as CreatedMasukPayload;
}

function getError(error: unknown) {
  return error instanceof Error ? error : new Error("Terjadi kesalahan");
}

/** Gangguan di luar transaksi stok (pencatatan stok sendiri sudah diterjemahkan service). */
function handleCreateMasukError(error: Error) {
  logger.error("Error creating barang masuk", error, {
    path: "/api/inventory/masuk",
    method: "POST",
  });
  return ApiErrors.internalError(INVENTORY_UNEXPECTED_ERROR_MESSAGE);
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
    logger.error("Error fetching barang masuk", getError(error), {
      path: "/api/inventory/masuk",
      method: "GET",
    });
    return ApiErrors.internalError(
      "Daftar barang masuk gagal dimuat karena ada gangguan di server. Muat ulang halaman. Kalau tetap gagal, laporkan ke admin.",
    );
  }
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  const denied = await ensureCreatePermission();
  if (denied) return denied;

  const parsed = await parseInventoryMutationBody(req);
  if (parsed.ok === false) return parsed.response;
  const body = parsed.body;

  const gudangDenied = await ensureCreateGudangAccess(ctx, body, "masuk");
  if (gudangDenied) return gudangDenied;

  try {
    const dbStart = Date.now();
    const result = await inventoryMasukRouteService.createMasuk({
      userId: user.id,
      tenantId: user.tenantId,
      body,
    });

    if (isInventoryMasukRouteFailure(result)) {
      return inventoryFailureResponse(result);
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
      barangId: String(body.barangId),
      gudangId: String(body.gudangId),
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
    return handleCreateMasukError(getError(error));
  }
});
