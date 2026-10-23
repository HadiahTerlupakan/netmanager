import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { UserLookupService } from "@/modules/users";
import {
  ApprovalThresholdExceededError,
  changePurchaseOrderItemsSchema,
  type ChangePurchaseOrderItemsBody,
  getPurchaseOrderItemChangeService,
  PurchaseOrderItemChangeInvalidError,
  PurchaseOrderNotEditableError,
  PurchaseOrderNotFoundError,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

const userLookupService = new UserLookupService();

/**
 * PATCH /api/admin/procurement/purchase-orders/[id]/items
 * Ubah isi PO yang sudah dipesan: kurangi jumlah baris atau tambah barang baru.
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

  const actorId = ctx.session?.user.id;
  if (!actorId) {
    return ApiErrors.unauthorized("Sesi tidak valid");
  }

  const validation = await validateRequestBody(
    req,
    changePurchaseOrderItemsSchema,
  );
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const userRecord = await userLookupService.findById(actorId);

  try {
    const result = await getPurchaseOrderItemChangeService().changeItems({
      purchaseOrderId: id,
      tenantId: ctx.session?.user.tenantId ?? null,
      actorId,
      actorRoleIds: userRecord?.roleId ? [userRecord.roleId] : [],
      ...(validation.data as ChangePurchaseOrderItemsBody),
    });
    return apiSuccess(result, { message: "Isi Purchase Order diperbarui" });
  } catch (error) {
    if (error instanceof PurchaseOrderNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    if (error instanceof PurchaseOrderNotEditableError) {
      return ApiErrors.conflict(error.message);
    }
    if (error instanceof PurchaseOrderItemChangeInvalidError) {
      return ApiErrors.badRequest(error.message);
    }
    if (error instanceof ApprovalThresholdExceededError) {
      return ApiErrors.forbidden(error.message);
    }
    throw error;
  }
});
