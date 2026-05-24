import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getGoodsReturnService,
  createGoodsReturnSchema,
  goodsReturnListQuerySchema,
  toGoodsReturnDTO,
  toGoodsReturnListItemDTO,
  GoodsReturnInvalidError,
  type CreateGoodsReturnInput,
  type GoodsReturnReason,
  type GoodsReturnStatus,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/procurement/goods-returns
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("goods_return:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat retur vendor",
    );
  }

  const url = new URL(req.url);
  const queryParse = goodsReturnListQuerySchema.safeParse({
    goodsReceiptId: url.searchParams.get("goodsReceiptId") ?? undefined,
    supplierId: url.searchParams.get("supplierId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!queryParse.success) {
    return ApiErrors.badRequest(
      queryParse.error.issues.map((i) => i.message).join(", "),
    );
  }

  const tenantId = ctx.session?.user.tenantId ?? null;
  const result = await getGoodsReturnService().list({
    tenantId,
    goodsReceiptId: queryParse.data.goodsReceiptId,
    supplierId: queryParse.data.supplierId,
    status: queryParse.data.status as GoodsReturnStatus | undefined,
    page: queryParse.data.page,
    limit: queryParse.data.limit,
  });

  return apiSuccess({
    items: result.items.map(toGoodsReturnListItemDTO),
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

/**
 * POST /api/admin/procurement/goods-returns
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("goods_return:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk membuat retur vendor",
    );
  }

  const userId = ctx.session?.user.id;
  if (!userId) {
    return ApiErrors.unauthorized("Sesi tidak valid");
  }

  const validation = await validateRequestBody(req, createGoodsReturnSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const data = validation.data as CreateGoodsReturnInput;
  const tenantId = ctx.session?.user.tenantId ?? null;

  try {
    const rtv = await getGoodsReturnService().create({
      goodsReceiptId: data.goodsReceiptId,
      reason: data.reason as GoodsReturnReason,
      returnedAt: data.returnedAt ? new Date(data.returnedAt) : undefined,
      notes: data.notes ?? null,
      fotoBukti: data.fotoBukti ?? [],
      returnedById: userId,
      tenantId,
      items: data.items.map((it) => ({
        goodsReceiptItemId: it.goodsReceiptItemId,
        barangId: it.barangId,
        quantity: it.quantity,
        notes: it.notes ?? null,
      })),
    });
    return apiSuccess(toGoodsReturnDTO(rtv), {
      message: "Retur vendor berhasil dibuat",
    });
  } catch (error) {
    if (error instanceof GoodsReturnInvalidError) {
      return ApiErrors.badRequest(error.message);
    }
    throw error;
  }
});
