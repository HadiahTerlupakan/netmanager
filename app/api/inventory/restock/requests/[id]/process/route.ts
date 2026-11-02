import { hasPermission } from "@/lib/rbac";
import { createHandler, ApiErrors } from "@/lib/api";
import {
  getInventoryRouteService,
  patchRestockRequestStatus,
  RESTOCK_MESSAGES,
  restockForbiddenMessage,
} from "@/modules/inventory";
import { ensureRestockRequestSiteAccess } from "../../../_lib/restock-site-access";

const inventoryRouteService = getInventoryRouteService();

/** Mulai proses belanja untuk purchase request yang sudah punya PO. */
export const PATCH = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("restock:verify"))) {
    return ApiErrors.forbidden(restockForbiddenMessage("restock:verify"));
  }

  const { id } = ctx.params;
  const tenantId = user.tenantId as string;
  const siteDenied = await ensureRestockRequestSiteAccess({
    user,
    purchaseRequestId: id,
    tenantId: user.tenantId as string,
  });
  if (siteDenied) return siteDenied;
  const requestRecord =
    await inventoryRouteService.getPurchaseRequestProcessInfo(id, tenantId);

  if (!requestRecord) {
    return ApiErrors.notFound(RESTOCK_MESSAGES.requestNotFound);
  }

  if (!requestRecord.purchaseOrderId) {
    return ApiErrors.badRequest(RESTOCK_MESSAGES.noPurchaseOrderYet);
  }

  return patchRestockRequestStatus({
    purchaseOrderId: requestRecord.purchaseOrderId,
    action: "START_SHOPPING",
    actorId: user.id as string,
  });
});
