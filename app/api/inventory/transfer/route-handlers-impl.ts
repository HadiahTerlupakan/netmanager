import { logger, logActivitySafe } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryTransferRouteService,
  type InventoryTransferRouteResult,
  buildInventoryAccessSession,
  validateGudangSiteAccess,
} from "@/modules/inventory";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { parsePaginationParams } from "@/lib/utils/pagination";

type InventoryTransferRouteFailure = Extract<
  InventoryTransferRouteResult<unknown>,
  { success: false }
>;

/** Check whether inventory transfer route service returned a failure. */
function isInventoryTransferRouteFailure(
  result: InventoryTransferRouteResult<unknown>,
): result is InventoryTransferRouteFailure {
  return !result.success;
}

/** Build transfer list input from request and user context. */
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
    dariGudangId: searchParams.get("dariGudangId") || undefined,
    keGudangId: searchParams.get("keGudangId") || undefined,
    siteId: searchParams.get("siteId") || undefined,
  };
}

/** Validate source and destination warehouse access. */
async function validateTransferAccess(
  user: { id: string },
  dariGudangId: string,
  keGudangId: string,
) {
  const accessSession = await buildInventoryAccessSession(user);
  const accessDari = await validateGudangSiteAccess(
    accessSession,
    dariGudangId,
  );
  if (!accessDari.allowed) {
    return ApiErrors.forbidden(`Gudang Sumber: ${accessDari.error}`);
  }

  const accessKe = await validateGudangSiteAccess(accessSession, keGudangId);
  if (!accessKe.allowed) {
    return ApiErrors.forbidden(`Gudang Tujuan: ${accessKe.error}`);
  }

  return null;
}

/** Map transfer create error into API response. */
function mapCreateTransferError(error: Error) {
  if (error.message === "Barang tidak ditemukan") {
    return ApiErrors.notFound("Barang");
  }
  if (
    error.message.includes("Gudang") &&
    (error.message.includes("tidak ditemukan") ||
      error.message.includes("tidak aktif") ||
      error.message.includes("sama"))
  ) {
    return ApiErrors.badRequest(error.message);
  }
  if (
    error.message.includes("Stok tidak mencukupi") ||
    error.message.includes("tidak mencukupi")
  ) {
    return ApiErrors.badRequest(error.message);
  }
  return ApiErrors.internalError("Gagal melakukan transfer barang");
}

/** Handle transfer list request. */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  if (!(await hasPermission("transfer:read"))) return ApiErrors.forbidden();

  try {
    const input = await buildListInput(req, user.id, isSuperAdmin(user));
    const dbStart = Date.now();
    const result = await inventoryTransferRouteService.listTransfers(input);

    logger.dbOperation(
      "findMany",
      "TransferAntarGudang+Relations",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "GET",
      "/api/inventory/transfer",
      200,
      Date.now() - startTime,
      {
        userId: user.id,
        count: result.transferList.length,
        page: input.page,
        limit: input.limit,
        total: result.pagination.total,
        barangId: input.barangId,
        dariGudangId: input.dariGudangId,
        keGudangId: input.keGudangId,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching transfer records", err, {
      path: "/api/inventory/transfer",
      method: "GET",
    });
    throw error;
  }
});

/** Handle transfer creation request. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  if (!(await hasPermission("transfer:create"))) return ApiErrors.forbidden();

  const body = await req.json();
  const accessError = await validateTransferAccess(
    user,
    body.dariGudangId,
    body.keGudangId,
  );
  if (accessError) return accessError;

  try {
    const dbStart = Date.now();
    const result = await inventoryTransferRouteService.createTransfer({
      userId: user.id,
      body,
    });
    if (isInventoryTransferRouteFailure(result))
      return ApiErrors.badRequest(result.error);

    const transferRecord = result.data as { id: string; kodeTransfer: string };
    logger.dbOperation(
      "transaction",
      "TransferAntarGudang+BarangMasuk+BarangKeluar+BarangGudang",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "POST",
      "/api/inventory/transfer",
      201,
      Date.now() - startTime,
      {
        userId: user.id,
        barangId: body.barangId,
        dariGudangId: body.dariGudangId,
        keGudangId: body.keGudangId,
        jumlah: body.jumlah,
        transferId: transferRecord.id,
        transferCode: transferRecord.kodeTransfer,
      },
    );

    logActivitySafe({
      action: "CREATE",
      subject: "Inventory Transfer",
      userId: user.id,
      details: {
        id: transferRecord.id,
        code: transferRecord.kodeTransfer,
        barangId: body.barangId,
        quantity: body.jumlah,
      },
    });

    return apiSuccess(
      {
        message: "Transfer barang antar gudang berhasil",
        transfer: transferRecord,
        kodeTransfer: transferRecord.kodeTransfer,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error creating transfer", err, {
      path: "/api/inventory/transfer",
      method: "POST",
    });
    return mapCreateTransferError(err);
  }
});
