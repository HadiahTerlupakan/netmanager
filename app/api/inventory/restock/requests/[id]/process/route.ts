import { NextRequest, NextResponse } from "next/server";

import { verifyAuth, hasPermission } from "@/lib/auth";
import {
  getInventoryRouteService,
  patchRestockRequestStatus,
} from "@/modules/inventory";

const inventoryRouteService = getInventoryRouteService();

/** Mulai proses belanja untuk purchase request yang sudah punya PO. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifyAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Tidak terautentikasi" },
      { status: 401 },
    );
  }

  const hasAccess = await hasPermission(session.id, "restock", "update");
  if (!hasAccess) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;
  const requestRecord =
    await inventoryRouteService.getPurchaseRequestProcessInfo(id);

  if (!requestRecord) {
    return NextResponse.json(
      { error: "Purchase Request not found" },
      { status: 404 },
    );
  }

  if (!requestRecord.purchaseOrderId) {
    return NextResponse.json(
      {
        error: "Purchase Request belum memiliki Purchase Order untuk diproses",
      },
      { status: 400 },
    );
  }

  return patchRestockRequestStatus({
    purchaseOrderId: requestRecord.purchaseOrderId,
    action: "START_SHOPPING",
    actorId: session.id,
  });
}
