import { logger, logActivitySafe } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  inventoryTransferRouteService,
  type InventoryTransferRouteResult,
  buildInventoryAccessSession,
  describeGudangAccessDenial,
  IZIN_PEMBATAS_TRANSFER,
  validateGudangSiteAccess,
  TRANSFER_MESSAGES,
} from "@/modules/inventory";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { parsePaginationParams } from "@/lib/utils/pagination";

type InventoryTransferRouteFailure = Extract<
  InventoryTransferRouteResult<unknown>,
  { success: false }
>;

const FORBIDDEN_READ_MESSAGE =
  "Akun Anda tidak punya izin melihat transfer barang. Minta admin menambahkan izinnya.";
const FORBIDDEN_CREATE_MESSAGE =
  "Akun Anda tidak punya izin memindah barang antar gudang. Minta admin menambahkan izinnya.";

/** Check whether inventory transfer route service returned a failure. */
function isInventoryTransferRouteFailure(
  result: InventoryTransferRouteResult<unknown>,
): result is InventoryTransferRouteFailure {
  return !result.success;
}

/** Ubah hasil gagal service menjadi respons API dengan status yang sesuai. */
function toTransferRouteResponse(result: InventoryTransferRouteFailure) {
  if (result.status === 404) return ApiErrors.notFound(result.error);
  if (result.status === 403) return ApiErrors.forbidden(result.error);
  if (result.status === 409) return ApiErrors.conflict(result.error);
  return ApiErrors.badRequest(result.error);
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

/**
 * Validasi akses ke gudang asal dan tujuan. Keduanya wajib di dalam lingkup
 * site pengguna, dengan permission pembatas yang sama dengan daftar transfer.
 */
async function validateTransferAccess(input: {
  user: { id: string };
  permissions: readonly string[];
  dariGudangId: string;
  keGudangId: string;
}) {
  const accessSession = await buildInventoryAccessSession(
    input.user,
    input.permissions,
  );
  const accessDari = await validateGudangSiteAccess(
    accessSession,
    input.dariGudangId,
    IZIN_PEMBATAS_TRANSFER,
  );
  if (!accessDari.allowed) {
    return ApiErrors.forbidden(
      `Gudang asal: ${describeGudangAccessDenial(accessDari.error)}`,
    );
  }

  const accessKe = await validateGudangSiteAccess(
    accessSession,
    input.keGudangId,
    IZIN_PEMBATAS_TRANSFER,
  );
  if (!accessKe.allowed) {
    return ApiErrors.forbidden(
      `Gudang tujuan: ${describeGudangAccessDenial(accessKe.error)}`,
    );
  }

  return null;
}

/** Handle transfer list request. */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  if (!(await hasPermission("transfer:read"))) {
    return ApiErrors.forbidden(FORBIDDEN_READ_MESSAGE);
  }

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
    return ApiErrors.internalError(TRANSFER_MESSAGES.gagalMuatDaftar);
  }
});

/** Handle transfer creation request. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now();
  const user = ctx.session!.user;
  if (!(await hasPermission("transfer:create"))) {
    return ApiErrors.forbidden(FORBIDDEN_CREATE_MESSAGE);
  }

  const body = (await req.json().catch((): null => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object") {
    return ApiErrors.badRequest(TRANSFER_MESSAGES.dataTidakTerbaca);
  }

  // Isian diperiksa dulu agar gudang yang kosong tidak sampai ke cek akses.
  const invalidBody =
    inventoryTransferRouteService.validateCreateTransferBody(body);
  if (invalidBody) return toTransferRouteResponse(invalidBody);

  const accessError = await validateTransferAccess({
    user,
    permissions: ctx.permissions,
    dariGudangId: String(body.dariGudangId),
    keGudangId: String(body.keGudangId),
  });
  if (accessError) return accessError;

  try {
    const dbStart = Date.now();
    const result = await inventoryTransferRouteService.createTransfer({
      userId: user.id,
      body,
    });
    if (isInventoryTransferRouteFailure(result)) {
      return toTransferRouteResponse(result);
    }

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
    return ApiErrors.internalError(TRANSFER_MESSAGES.gagalSimpan);
  }
});
