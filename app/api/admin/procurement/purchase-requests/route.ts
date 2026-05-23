import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import {
  getProcurementService,
  purchaseRequestListQuerySchema,
  toPurchaseRequestSummaryDTO,
} from "@/modules/procurement";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/procurement/purchase-requests
 * Listing read-only Purchase Request untuk view procurement.
 * Lifecycle PR (approve/reject/process/receive) tetap di app/api/inventory/restock.
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("purchase_orders:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat purchase request",
    );
  }

  const url = new URL(req.url);
  const queryParse = purchaseRequestListQuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
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
  const result = await getProcurementService().listPurchaseRequests({
    tenantId,
    search: queryParse.data.search,
    status: queryParse.data.status,
    page: queryParse.data.page,
    limit: queryParse.data.limit,
  });

  return apiSuccess({
    data: result.data.map(toPurchaseRequestSummaryDTO),
    total: result.total,
    page: result.page,
    limit: result.limit,
  });
});
