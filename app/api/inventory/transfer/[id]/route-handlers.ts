import { NextRequest } from "next/server";
import {
  inventoryTransferRouteService,
  type InventoryTransferRouteResult,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { hasPermission } from "@/lib/rbac";

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

/** Require authenticated session for transfer controller. */
async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}

/** Map update transfer error into API response. */
function mapUpdateTransferError(error: Error) {
  if ((error as Error & { code?: string }).code === "P2025") {
    return ApiErrors.notFound("Record transfer tidak ditemukan");
  }

  return ApiErrors.internalError("Gagal memperbarui record transfer");
}

/** Map delete transfer error into API response. */
function mapDeleteTransferError(error: Error) {
  if (error.message === "Record transfer tidak ditemukan") {
    return ApiErrors.notFound("Record transfer tidak ditemukan");
  }

  if (
    error.message.includes("tidak mencukupi untuk pembatalan transfer") ||
    error.message.includes("tidak ditemukan di gudang tujuan")
  ) {
    return ApiErrors.badRequest(error.message);
  }

  return ApiErrors.internalError("Gagal membatalkan transfer");
}

/** Handle transfer detail request. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    const session = await requireSession();
    if (!session) return ApiErrors.unauthorized();
    if (!(await hasPermission("transfer:read"))) return ApiErrors.forbidden();

    const { id } = await params;
    const dbStart = Date.now();
    const result = await inventoryTransferRouteService.getTransferDetail(id);

    logger.dbOperation(
      "findUnique",
      "TransferAntarGudang+Relations",
      Date.now() - dbStart,
    );
    if (!result.found) {
      return ApiErrors.notFound("Record transfer tidak ditemukan");
    }

    logger.apiRequest(
      "GET",
      `/api/inventory/transfer/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        transferId: id,
      },
    );
    return apiSuccess({ transfer: result.transfer });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error fetching transfer record", err, {
      path: "/api/inventory/transfer/[id]",
      method: "GET",
    });
    return ApiErrors.internalError("Gagal memuat data transfer");
  }
}

/** Handle transfer update request. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    const session = await requireSession();
    if (!session) return ApiErrors.unauthorized();
    if (!(await hasPermission("transfer:create"))) return ApiErrors.forbidden();

    const { id } = await params;
    const body = await req.json();
    const dbStart = Date.now();
    const result = await inventoryTransferRouteService.updateTransfer({
      id,
      body,
    });

    if (isInventoryTransferRouteFailure(result)) {
      return ApiErrors.badRequest(result.error);
    }

    logger.dbOperation("update", "TransferAntarGudang", Date.now() - dbStart);
    logger.apiRequest(
      "PUT",
      `/api/inventory/transfer/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        transferId: id,
      },
    );

    return apiSuccess({
      message: "Transfer record berhasil diperbarui",
      transfer: result.data,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error updating transfer record", err, {
      path: "/api/inventory/transfer/[id]",
      method: "PUT",
    });
    return mapUpdateTransferError(err);
  }
}

/** Handle transfer delete request. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const startTime = Date.now();

  try {
    const session = await requireSession();
    if (!session) return ApiErrors.unauthorized();
    if (!(await hasPermission("transfer:delete"))) return ApiErrors.forbidden();

    const { id } = await params;
    const dbStart = Date.now();
    await inventoryTransferRouteService.deleteTransfer(id);

    logger.dbOperation(
      "transaction",
      "TransferAntarGudang+RelatedRecords+BarangGudang",
      Date.now() - dbStart,
    );
    logger.apiRequest(
      "DELETE",
      `/api/inventory/transfer/${id}`,
      200,
      Date.now() - startTime,
      {
        userId: session.user.id,
        transferId: id,
      },
    );

    return apiSuccess({
      message: "Transfer berhasil dibatalkan and stok dikembalikan",
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error deleting transfer record", err, {
      path: "/api/inventory/transfer/[id]",
      method: "DELETE",
    });
    return mapDeleteTransferError(err);
  }
}
