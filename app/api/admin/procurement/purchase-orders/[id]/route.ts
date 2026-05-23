import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getPurchaseOrderService,
  updatePurchaseOrderSchema,
  PurchaseOrderNotFoundError,
  PurchaseOrderNotEditableError,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/procurement/purchase-orders/[id]
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("purchase_orders:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat purchase order",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID purchase order tidak valid");
  }

  try {
    const po = await getPurchaseOrderService().getById(id);
    return apiSuccess(po);
  } catch (error) {
    if (error instanceof PurchaseOrderNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});

/**
 * PATCH /api/admin/procurement/purchase-orders/[id]
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("purchase_orders:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah purchase order",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID purchase order tidak valid");
  }

  const validation = await validateRequestBody(req, updatePurchaseOrderSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  try {
    const po = await getPurchaseOrderService().update(id, validation.data);
    return apiSuccess(po, { message: "Purchase Order berhasil diperbarui" });
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

/**
 * DELETE /api/admin/procurement/purchase-orders/[id]
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("purchase_orders:delete"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menghapus purchase order",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID purchase order tidak valid");
  }

  try {
    await getPurchaseOrderService().delete(id);
    return apiSuccess({ id }, { message: "Purchase Order berhasil dihapus" });
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
