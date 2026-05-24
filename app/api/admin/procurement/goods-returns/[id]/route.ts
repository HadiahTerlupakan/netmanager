import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getGoodsReturnService,
  resolveGoodsReturnSchema,
  toGoodsReturnDTO,
  GoodsReturnInvalidError,
  GoodsReturnNotFoundError,
  type ResolveGoodsReturnInput,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/procurement/goods-returns/[id]
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("goods_return:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat retur vendor",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID RTV tidak valid");
  }

  try {
    const rtv = await getGoodsReturnService().getById(id);
    return apiSuccess(toGoodsReturnDTO(rtv));
  } catch (error) {
    if (error instanceof GoodsReturnNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});

/**
 * PATCH /api/admin/procurement/goods-returns/[id]
 * Resolve RTV (REFUNDED/REPLACED/CREDIT_NOTE/CANCELLED).
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("goods_return:update"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk mengubah retur vendor",
    );
  }

  const id = ctx.params?.id;
  if (typeof id !== "string") {
    return ApiErrors.badRequest("ID RTV tidak valid");
  }

  const validation = await validateRequestBody(req, resolveGoodsReturnSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const data = validation.data as ResolveGoodsReturnInput;
  try {
    const rtv = await getGoodsReturnService().resolve(id, {
      status: data.status,
      resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : undefined,
      refundAmount: data.refundAmount ?? null,
      replacementGrnId: data.replacementGrnId ?? null,
      creditNoteRef: data.creditNoteRef ?? null,
      notes: data.notes ?? null,
    });
    return apiSuccess(toGoodsReturnDTO(rtv), {
      message: "Status retur berhasil diperbarui",
    });
  } catch (error) {
    if (error instanceof GoodsReturnNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    if (error instanceof GoodsReturnInvalidError) {
      return ApiErrors.badRequest(error.message);
    }
    throw error;
  }
});
