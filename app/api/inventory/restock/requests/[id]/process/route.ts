import { hasPermission } from "@/lib/rbac";
import { createHandler, ApiErrors } from "@/lib/api";
import {
  getInventoryRouteService,
  patchRestockRequestStatus,
} from "@/modules/inventory";

const inventoryRouteService = getInventoryRouteService();

/** Mulai proses belanja untuk purchase request yang sudah punya PO. */
export const PATCH = createHandler({ auth: true }, async (_req, ctx) => {
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

  if (!requestRecord.purchaseOrderId) {
    return ApiErrors.badRequest(
      "Purchase Request belum memiliki Purchase Order untuk diproses",
    );
  }

  return patchRestockRequestStatus({
    purchaseOrderId: requestRecord.purchaseOrderId,
    action: "START_SHOPPING",
    actorId: user.id as string,
  });
});
