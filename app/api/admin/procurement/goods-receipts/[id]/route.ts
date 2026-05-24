import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getGoodsReceiptService,
  toGoodsReceiptDTO,
  GoodsReceiptNotFoundError,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/procurement/goods-receipts/[id]
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("goods_receipt:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat goods receipt",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID GRN tidak valid");
  }

  try {
    const grn = await getGoodsReceiptService().getById(id);
    return apiSuccess(toGoodsReceiptDTO(grn));
  } catch (error) {
    if (error instanceof GoodsReceiptNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});
