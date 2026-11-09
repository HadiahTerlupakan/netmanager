import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  getInventoryRouteService,
  getRestockRequestDetail,
  RESTOCK_MESSAGES,
  restockForbiddenMessage,
} from "@/modules/inventory";
import {
  getPurchaseOrderService,
  PurchaseOrderNotFoundError,
  PurchaseOrderNotEditableError,
  PurchaseOrderHasPurchasesError,
} from "@/modules/procurement";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { handleRestockLifecycleRequest } from "./restock-lifecycle.handler";
import { handleRestockPutRequest } from "./restock-put.handler";
import { ensureRestockRequestSiteAccess } from "../../_lib/restock-site-access";

const inventoryRouteService = getInventoryRouteService();

const PURCHASE_ORDER_LOCKED_MESSAGE =
  "Pengajuan ini tidak bisa dihapus karena barang pesanannya sudah diterima dan sudah masuk gudang.";

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

/** Setujui (per baris) atau tolak purchase request restock. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRestockLifecycleRequest(req, id);
}

/** Perbarui purchase request draft/submitted. */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRestockPutRequest(req, id);
}

/** Hapus purchase request restock. */
export async function DELETE(
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

  if (!(await hasPermission("restock:delete"))) {
    return NextResponse.json(
      { error: restockForbiddenMessage("restock:delete") },
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
  const existing = await inventoryRouteService.getPurchaseRequestById({
    id,
    tenantId,
  });

  if (!existing) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.requestNotFound },
      { status: 404 },
    );
  }

  if (existing.status === "RECEIVED") {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.cannotDeleteReceived },
      { status: 409 },
    );
  }

  if (
    await inventoryRouteService.hasPurchaseRequestArrivedGoods(
      existing.purchaseOrderId,
    )
  ) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.cannotDeleteAfterArrival },
      { status: 409 },
    );
  }

  if (
    await inventoryRouteService.hasPurchaseRequestPurchases(
      existing.purchaseOrderId,
    )
  ) {
    return NextResponse.json(
      { error: RESTOCK_MESSAGES.cannotDeleteAfterPurchase },
      { status: 409 },
    );
  }

  if (existing.purchaseOrderId) {
    try {
      await getPurchaseOrderService().delete(existing.purchaseOrderId);
    } catch (err) {
      if (err instanceof PurchaseOrderHasPurchasesError) {
        return NextResponse.json(
          { error: RESTOCK_MESSAGES.cannotDeleteAfterPurchase },
          { status: 409 },
        );
      }
      if (err instanceof PurchaseOrderNotEditableError) {
        return NextResponse.json(
          { error: PURCHASE_ORDER_LOCKED_MESSAGE },
          { status: 409 },
        );
      }
      if (!(err instanceof PurchaseOrderNotFoundError)) {
        throw err;
      }
    }
  }

  await inventoryRouteService.deletePurchaseRequest({
    id,
    nomorRequest: existing.nomorRequest,
    purchaseOrderId: existing.purchaseOrderId,
    actorId: session.user.id as string,
    tenantId,
  });
  return NextResponse.json({ message: "Pengajuan berhasil dihapus" });
}
