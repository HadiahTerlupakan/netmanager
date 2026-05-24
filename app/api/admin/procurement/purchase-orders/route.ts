import {
  apiSuccess,
  ApiErrors,
  createHandler,
  validateRequestBody,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { UserLookupService } from "@/modules/users";
import {
  getPurchaseOrderService,
  createPurchaseOrderSchema,
  purchaseOrderListQuerySchema,
  PurchaseOrderNotFoundError,
  SupplierNotActiveError,
  ApprovalThresholdExceededError,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

const userLookupService = new UserLookupService();

/**
 * GET /api/admin/procurement/purchase-orders - List PO (paginated, filterable).
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("purchase_orders:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat purchase order",
    );
  }

  const url = new URL(req.url);
  const queryParse = purchaseOrderListQuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    paymentStatus: url.searchParams.get("paymentStatus") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!queryParse.success) {
    return ApiErrors.badRequest(
      queryParse.error.issues.map((i) => i.message).join(", "),
    );
  }

  const tenantId = ctx.session?.user.tenantId ?? null;
  const result = await getPurchaseOrderService().list({
    tenantId,
    search: queryParse.data.search,
    status: queryParse.data.status,
    paymentStatus: queryParse.data.paymentStatus,
    page: queryParse.data.page,
    limit: queryParse.data.limit,
  });

  return apiSuccess(result);
});

/**
 * POST /api/admin/procurement/purchase-orders - Create new PO.
 * Auto-populates `vendorNpwp` dari supplier master jika tidak di-supply.
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("purchase_orders:create"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk menambah purchase order",
    );
  }

  const validation = await validateRequestBody(req, createPurchaseOrderSchema);
  if (!validation.success) {
    return ApiErrors.badRequest(
      validation.errors?.map((e) => e.message).join(", ") ??
        "Input tidak valid",
    );
  }

  const userId = ctx.session?.user.id;
  if (!userId) {
    return ApiErrors.unauthorized("Sesi tidak valid");
  }

  const tenantId = ctx.session?.user.tenantId ?? null;
  const userRecord = await userLookupService.findById(userId);
  const creatorRoleIds = userRecord?.roleId ? [userRecord.roleId] : [];

  try {
    const data = validation.data as {
      supplierId?: string | null;
      expectedDate?: Date | null;
      notes?: string | null;
      ppnRate?: number;
      vendorNpwp?: string | null;
      items: Array<{
        barangId: string;
        quantity: number;
        unitPrice: number;
      }>;
    };
    const po = await getPurchaseOrderService().create({
      ...data,
      createdBy: userId,
      tenantId,
      creatorRoleIds,
    });
    return apiSuccess(po, { message: "Purchase Order berhasil dibuat" });
  } catch (error) {
    if (error instanceof PurchaseOrderNotFoundError) {
      return ApiErrors.notFound(error.message);
    }
    if (error instanceof SupplierNotActiveError) {
      return ApiErrors.conflict(error.message);
    }
    if (error instanceof ApprovalThresholdExceededError) {
      return ApiErrors.forbidden(error.message);
    }
    throw error;
  }
});
