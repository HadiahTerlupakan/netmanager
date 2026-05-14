import { NextRequest } from "next/server";
import {
  inventoryTransferRouteService,
  type InventoryTransferRouteResult,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
} from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
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

/** Map service failure result into API response. */
function toTransferRouteResponse(result: InventoryTransferRouteFailure) {
  if (result.status === 404) return ApiErrors.notFound(result.error);
  if (result.status === 403) return ApiErrors.forbidden(result.error);
  if (result.status === 400) {
    return apiError(result.error, ErrorCodes.VALIDATION_ERROR, { status: 400 });
  }
  return ApiErrors.internalError(result.error);
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
  try {
    const session = await requireSession();
    if (!session) return ApiErrors.unauthorized();
    if (!(await hasPermission("transfer:read"))) return ApiErrors.forbidden();

    const { id } = await params;
    const permissions = await getUserPermissions(session.user.id);
    const result = await inventoryTransferRouteService.getTransferDetail({
      id,
      userId: session.user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(session.user),
    });

    if (result.success === false) return toTransferRouteResponse(result);
    return apiSuccess({ transfer: result.data.transfer });
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
  try {
    const session = await requireSession();
    if (!session) return ApiErrors.unauthorized();
    if (!(await hasPermission("transfer:update"))) return ApiErrors.forbidden();

    const { id } = await params;
    const body = await req.json();
    const permissions = await getUserPermissions(session.user.id);
    const result = await inventoryTransferRouteService.updateTransfer({
      id,
      body,
      userId: session.user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(session.user),
    });

    if (isInventoryTransferRouteFailure(result)) {
      return toTransferRouteResponse(result);
    }

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
  try {
    const session = await requireSession();
    if (!session) return ApiErrors.unauthorized();
    if (!(await hasPermission("transfer:delete"))) return ApiErrors.forbidden();

    const { id } = await params;
    const permissions = await getUserPermissions(session.user.id);
    const result = await inventoryTransferRouteService.deleteTransfer({
      id,
      userId: session.user.id,
      permissions,
      isSuperAdmin: isSuperAdmin(session.user),
    });

    if (result.success === false) return toTransferRouteResponse(result);

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
