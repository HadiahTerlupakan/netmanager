import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getGoodsReceiptService,
  createGoodsReceiptSchema,
  goodsReceiptListQuerySchema,
  toGoodsReceiptDTO,
  toGoodsReceiptListItemDTO,
  GoodsReceiptInvalidError,
  GoodsReceiptNotFoundError,
  PurchaseOrderNotFoundError,
  type CreateGoodsReceiptInput,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/procurement/goods-receipts
 * List GRN, optional filter by purchaseOrderId atau status.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("goods_receipt:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat goods receipt",
    );
  }

  const url = new URL(req.url);
  const queryParse = goodsReceiptListQuerySchema.safeParse({
    purchaseOrderId: url.searchParams.get("purchaseOrderId") ?? undefined,
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
  const result = await getGoodsReceiptService().list({
    tenantId,
    purchaseOrderId: queryParse.data.purchaseOrderId,
    status: queryParse.data.status,
    page: queryParse.data.page,
    limit: queryParse.data.limit,
  });

  return apiSuccess({
    items: result.items.map(toGoodsReceiptListItemDTO),
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});

/**
 * POST /api/admin/procurement/goods-receipts
 * Buat GRN baru + post stok dalam satu transaksi.
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("goods_receipt:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menerima barang",
    );
  }

  const userId = ctx.session?.user.id;
  if (!userId) {
    return ApiErrors.unauthorized("Sesi tidak valid");
  }

  const validation = await validateRequestBody(req, createGoodsReceiptSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const data = validation.data as CreateGoodsReceiptInput;
  const tenantId = ctx.session?.user.tenantId ?? null;

  try {
    const grn = await getGoodsReceiptService().create({
      purchaseOrderId: data.purchaseOrderId,
      gudangId: data.gudangId,
      receivedAt: data.receivedAt ? new Date(data.receivedAt) : undefined,
      notes: data.notes ?? null,
      fotoBukti: data.fotoBukti ?? [],
      receivedById: userId,
      tenantId,
      items: data.items.map((it) => ({
        purchaseOrderItemId: it.purchaseOrderItemId,
        barangId: it.barangId,
        quantity: it.quantity,
        notes: it.notes ?? null,
      })),
    });
    return apiSuccess(toGoodsReceiptDTO(grn), {
      message: "Goods Receipt berhasil dibuat",
    });
  } catch (error) {
    if (error instanceof PurchaseOrderNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    if (error instanceof GoodsReceiptInvalidError) {
      return ApiErrors.badRequest(error.message);
    }
    if (error instanceof GoodsReceiptNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    throw error;
  }
});
