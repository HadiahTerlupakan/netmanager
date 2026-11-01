import { NextRequest } from "next/server";
import {
  inventoryTransferRouteService,
  type InventoryTransferRouteResult,
  TRANSFER_MESSAGES,
} from "@/modules/inventory";
import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { authOptions } from "@/lib/auth";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { hasPermission } from "@/lib/rbac";

type InventoryTransferRouteFailure = Extract<
  InventoryTransferRouteResult<unknown>,
  { success: false }
>;

const SESSION_EXPIRED_MESSAGE =
  "Waktu login Anda sudah habis. Silakan masuk (login) lagi.";
const FORBIDDEN_MESSAGES = {
  read: "Akun Anda tidak punya izin melihat transfer barang. Minta admin menambahkan izinnya.",
  update:
    "Akun Anda tidak punya izin mengubah keterangan transfer. Minta admin menambahkan izinnya.",
  delete:
    "Akun Anda tidak punya izin membatalkan transfer. Minta admin menambahkan izinnya.",
} as const;

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

/** Ubah hasil gagal service menjadi respons API dengan status yang sesuai. */
function toTransferRouteResponse(result: InventoryTransferRouteFailure) {
  if (result.status === 404) return ApiErrors.notFound(result.error);
  if (result.status === 403) return ApiErrors.forbidden(result.error);
  if (result.status === 409) return ApiErrors.conflict(result.error);
  return ApiErrors.badRequest(result.error);
}

/** Handle transfer detail request. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    if (!session) return ApiErrors.unauthorized(SESSION_EXPIRED_MESSAGE);
    if (!(await hasPermission("transfer:read"))) {
      return ApiErrors.forbidden(FORBIDDEN_MESSAGES.read);
    }

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
    return ApiErrors.internalError(TRANSFER_MESSAGES.gagalMuatDetail);
  }
}

/** Handle transfer update request. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    if (!session) return ApiErrors.unauthorized(SESSION_EXPIRED_MESSAGE);
    if (!(await hasPermission("transfer:update"))) {
      return ApiErrors.forbidden(FORBIDDEN_MESSAGES.update);
    }

    const { id } = await params;
    const body = (await req.json().catch((): null => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      return ApiErrors.badRequest(TRANSFER_MESSAGES.dataTidakTerbaca);
    }
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
      message: "Keterangan transfer berhasil disimpan",
      transfer: result.data,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error updating transfer record", err, {
      path: "/api/inventory/transfer/[id]",
      method: "PUT",
    });
    return ApiErrors.internalError(TRANSFER_MESSAGES.gagalUbahKeterangan);
  }
}

/** Handle transfer delete request. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession();
    if (!session) return ApiErrors.unauthorized(SESSION_EXPIRED_MESSAGE);
    if (!(await hasPermission("transfer:delete"))) {
      return ApiErrors.forbidden(FORBIDDEN_MESSAGES.delete);
    }

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
      message: "Transfer berhasil dibatalkan dan stok sudah dikembalikan",
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error("Terjadi kesalahan");
    logger.error("Error deleting transfer record", err, {
      path: "/api/inventory/transfer/[id]",
      method: "DELETE",
    });
    return ApiErrors.internalError(TRANSFER_MESSAGES.gagalBatal);
  }
}
