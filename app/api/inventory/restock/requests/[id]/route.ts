import { authOptions } from "@/lib/auth";
import { ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import {
  deleteRestockRequest,
  getRestockRequestDetail,
  RESTOCK_MESSAGES,
  restockForbiddenMessage,
  restockServerErrorMessage,
  type RestockDeleteErrorCode,
} from "@/modules/inventory";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { handleRestockLifecycleRequest } from "./restock-lifecycle.handler";
import { handleRestockPutRequest } from "./restock-put.handler";
import { ensureRestockRequestSiteAccess } from "../../_lib/restock-site-access";

const DELETE_ERROR_RESPONSES: Record<
  RestockDeleteErrorCode,
  (message: string) => NextResponse
> = {
  NOT_FOUND: ApiErrors.notFound,
  CONFLICT: ApiErrors.conflict,
};

/** Ambil detail purchase request restock. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.sessionExpired },
      { status: 401 },
    );
  }

  if (!(await hasPermission("restock:read"))) {
    return NextResponse.json(
      { error: restockForbiddenMessage("restock:read") },
      { status: 403 },
    );
  }

  const { id } = await params;
  const tenantId = session.user.tenantId as string;
  const siteDenied = await ensureRestockRequestSiteAccess({
    user: session.user,
    purchaseRequestId: id,
    tenantId: session.user.tenantId as string,
  });
  if (siteDenied) return siteDenied;
  return getRestockRequestDetail(id, tenantId);
}

/**
 * Putuskan pengajuan restock: setujui (per baris) atau tolak, atau batalkan
 * pengajuan yang sudah disetujui dengan alasan (`action: "CANCEL"`).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRestockLifecycleRequest(req, id);
}

/** Perbarui pengajuan restock yang belum diputuskan dan belum punya pesanan. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRestockPutRequest(req, id);
}

/** Hapus pengajuan restock yang belum ada barang atau jasanya masuk. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return ApiErrors.unauthorized(RESTOCK_MESSAGES.sessionExpired);
  }
  if (!(await hasPermission("restock:delete"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:delete"));
  }

  const { id } = await params;
  const tenantId = session.user.tenantId as string;
  const siteDenied = await ensureRestockRequestSiteAccess({
    user: session.user,
    purchaseRequestId: id,
    tenantId,
  });
  if (siteDenied) return siteDenied;

  try {
    const result = await deleteRestockRequest({
      id,
      tenantId,
      actorId: session.user.id as string,
    });
    if (result.success === false) {
      return DELETE_ERROR_RESPONSES[result.code](result.error);
    }
    return NextResponse.json({ message: "Pengajuan berhasil dihapus" });
  } catch (error: unknown) {
    logger.error(
      "Error deleting purchase request",
      error instanceof Error ? error : new Error(String(error)),
      { purchaseRequestId: id },
    );
    // Pesanan dihapus lebih dulu, baru pengajuannya, jadi tidak satu transaksi.
    return ApiErrors.internalError(
      restockServerErrorMessage("Menghapus pengajuan", false),
    );
  }
}
