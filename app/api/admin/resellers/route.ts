import {
  apiPaginated,
  apiSuccess,
  createHandler,
  requireSessionTenantId,
} from "@/lib/api";
import {
  createResellerSchema,
  getResellerService,
  listResellersQuerySchema,
} from "@/modules/reseller";

export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const tenantId = requireSessionTenantId(ctx);
    const query = listResellersQuerySchema.parse(ctx.query);
    const result = await getResellerService().listResellers({
      tenantId,
      ...query,
    });

    return apiPaginated([...result.items], {
      page: query.page,
      limit: query.limit,
      total: result.total,
    });
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: ["reseller:create"],
    schema: createResellerSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    const reseller = await getResellerService().createReseller({
      ...ctx.validated,
      tenantId: requireSessionTenantId(ctx),
    });
    return apiSuccess(reseller, { status: 201 });
  },
);
