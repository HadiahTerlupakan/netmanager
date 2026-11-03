import {
  apiPaginated,
  ApiErrors,
  createHandler,
  requireSessionTenantId,
} from "@/lib/api";
import {
  getResellerStatusHistoryService,
  listResellerStatusHistoryQuerySchema,
} from "@/modules/reseller";

/** Riwayat status kemitraan reseller, terbaru lebih dulu (paginated). */
export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const query = listResellerStatusHistoryQuerySchema.parse(ctx.query);
    const result = await getResellerStatusHistoryService().listStatusHistory({
      tenantId: requireSessionTenantId(ctx),
      resellerId: ctx.params.id,
      page: query.page,
      limit: query.limit,
    });
    if (!result) return ApiErrors.notFound("Reseller");
    return apiPaginated([...result.items], {
      page: query.page,
      limit: query.limit,
      total: result.total,
    });
  },
);
