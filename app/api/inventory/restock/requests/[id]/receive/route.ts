import { hasPermission } from "@/lib/rbac";
import { createHandler, ApiErrors } from "@/lib/api";
import {
  getInventoryRouteService,
  patchRestockRequestStatus,
} from "@/modules/inventory";
import { ProcurementService } from "@/modules/procurement";

const inventoryRouteService = getInventoryRouteService();

/** Terima barang dari purchase request restock. */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden("Akses ditolak. Butuh izin restock:verify");
  }

  const { id } = ctx.params;
  const requestRecord =
    await inventoryRouteService.getPurchaseRequestProcessInfo(id);

  if (!requestRecord) {
    return ApiErrors.notFound("Purchase Request not found");
  }

  let purchaseOrderId = requestRecord.purchaseOrderId;
  if (!purchaseOrderId) {
    try {
      const procurementService = new ProcurementService();
      const purchaseOrders = await procurementService.generatePOFromPRs(
        [id],
        user.id as string,
      );
      purchaseOrderId = purchaseOrders?.[0]?.id;
    } catch (_error) {
      purchaseOrderId = undefined;
    }
  }

  if (!purchaseOrderId) {
    return ApiErrors.internalError(
      "Gagal membuat Purchase Order. Coba lagi atau hubungi admin.",
    );
  }

  const body = await req.json();
  return patchRestockRequestStatus({
    purchaseOrderId,
    action: "RECEIVE",
    items: body.items,
    closePO: body.closePO,
    actorId: user.id as string,
    fotoBukti: body.fotoBukti,
  });
});
