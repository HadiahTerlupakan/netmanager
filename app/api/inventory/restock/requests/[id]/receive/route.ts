import { NextRequest, NextResponse } from "next/server";

import { verifyAuth, hasPermission } from "@/lib/auth";
import {
  getInventoryRouteService,
  patchRestockRequestStatus,
} from "@/modules/inventory";
import { ProcurementService } from "@/modules/procurement";

const inventoryRouteService = getInventoryRouteService();

/** Terima barang dari purchase request restock. */
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

  const hasAccess = await hasPermission(session.id, "restock", "verify");
  if (!hasAccess) {
    return NextResponse.json(
      { error: "Akses ditolak. Butuh izin restock:verify" },
      { status: 403 },
    );
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

  let purchaseOrderId = requestRecord.purchaseOrderId;
  if (!purchaseOrderId) {
    try {
      const procurementService = new ProcurementService();
      const purchaseOrders = await procurementService.generatePOFromPRs(
        [id],
        session.id,
      );
      purchaseOrderId = purchaseOrders?.[0]?.id;
    } catch (_error) {
      purchaseOrderId = undefined;
    }
  }

  if (!purchaseOrderId) {
    return NextResponse.json(
      { error: "Gagal membuat Purchase Order. Coba lagi atau hubungi admin." },
      { status: 500 },
    );
  }

  const body = await req.json();
  return patchRestockRequestStatus({
    purchaseOrderId,
    action: "RECEIVE",
    items: body.items,
    closePO: body.closePO,
    actorId: session.id,
    fotoBukti: body.fotoBukti,
  });
}
