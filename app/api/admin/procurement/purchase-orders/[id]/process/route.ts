import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getPurchaseOrderService,
  PurchaseOrderNotFoundError,
  PurchaseOrderNotEditableError,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/procurement/purchase-orders/[id]/process
 * DRAFT → ORDERED. Setelah ORDERED, PO muncul di finance/unpaid untuk dibayar.
 */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("purchase_orders:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk memproses purchase order",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID purchase order tidak valid");
  }

  const actorId = ctx.session?.user.id;
  if (!actorId) {
    return ApiErrors.unauthorized("Sesi tidak valid");
  }

  try {
    const po = await getPurchaseOrderService().process(id, actorId);
    return apiSuccess(po, {
      message: "Purchase Order diproses menjadi Ordered",
    });
  } catch (error) {
    if (error instanceof PurchaseOrderNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    if (error instanceof PurchaseOrderNotEditableError) {
      return ApiErrors.conflict(error.message);
    }
    throw error;
  }
});
