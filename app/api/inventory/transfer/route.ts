import { logger } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryTransferRouteService,
  type InventoryTransferRouteResult,
} from "@/modules/inventory";
import { logActivitySafe } from "@/lib/logger";
import {
  buildInventoryAccessSession,
  validateGudangSiteAccess,
} from "@/modules/inventory";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { parsePaginationParams } from "@/lib/utils/pagination";

type InventoryTransferRouteFailure = Extract<
  InventoryTransferRouteResult<unknown>,
  { success: false }
>;

function isInventoryTransferRouteFailure(
  result: InventoryTransferRouteResult<unknown>,
): result is InventoryTransferRouteFailure {
  return !result.success;
}

/**
 * GET /api/inventory/transfer
 * Get all transfer records with filters
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("transfer:read"))) {
    return ApiErrors.forbidden();
  }

  const searchParams = req.nextUrl.searchParams;
  const barangId = searchParams.get("barangId") || undefined;
  const dariGudangId = searchParams.get("dariGudangId") || undefined;
  const keGudangId = searchParams.get("keGudangId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  const { page, limit } = parsePaginationParams(searchParams, {
    page: 1,
    limit: 20,
  });
  const permissions = await getUserPermissions(user.id);

  try {
    const dbStart = Date.now();
    const result = await inventoryTransferRouteService.listTransfers({
      userId: user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(user),
      page,
      limit,
      barangId,
      dariGudangId,
      keGudangId,
      siteId,
    });
    const transferList = result.transferList;
    const total = result.pagination.total;

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
        count: transferList.length,
        page,
        limit,
        total,
        barangId,
        dariGudangId,
        keGudangId,
      },
    );

    return apiSuccess(result);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching transfer records", err, {
      path: "/api/inventory/transfer",
      method: "GET",
    });
    throw error; // Let createHandler handle it
  }
});

/**
 * POST /api/inventory/transfer
 * Create new transfer record
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;

  if (!(await hasPermission("transfer:create"))) {
    return ApiErrors.forbidden();
  }

  const body = await req.json();
  const { barangId, dariGudangId, keGudangId, jumlah } = body;

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

  try {
    const dbStart = Date.now();

    const result = await inventoryTransferRouteService.createTransfer({
      userId: user.id,
      body,
    });

    if (isInventoryTransferRouteFailure(result)) {
      return ApiErrors.badRequest(result.error);
    }

    const transferRecord = result.data as {
      id: string;
      kodeTransfer: string;
    };

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
        barangId,
        dariGudangId,
        keGudangId,
        jumlah,
        transferId: transferRecord.id,
        transferCode: transferRecord.kodeTransfer,
      },
    );

    // System Log
    logActivitySafe({
      action: "CREATE",
      subject: "Inventory Transfer",
      userId: user.id,
      details: {
        id: transferRecord.id,
        code: transferRecord.kodeTransfer,
        barangId,
        quantity: jumlah,
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

    if (err.message === "Barang tidak ditemukan") {
      return ApiErrors.notFound("Barang tidak ditemukan");
    }
    if (
      err.message.includes("Gudang") &&
      (err.message.includes("tidak ditemukan") ||
        err.message.includes("tidak aktif") ||
        err.message.includes("sama"))
    ) {
      return ApiErrors.badRequest(err.message);
    }
    if (
      err.message.includes("Stok tidak mencukupi") ||
      err.message.includes("tidak mencukupi")
    ) {
      return ApiErrors.badRequest(err.message);
    }

    return ApiErrors.internalError("Gagal melakukan transfer barang");
  }
});
