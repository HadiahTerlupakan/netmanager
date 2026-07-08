import { apiPaginated, createHandler } from "@/lib/api";
import {
  getResellerCommissionService,
  toCommissionDTO,
} from "@/modules/reseller";

function getTenantId(ctx: {
  session: { user: { tenantId?: string | null } } | null;
}) {
  return ctx.session?.user.tenantId ?? null;
}

export const GET = createHandler(
  {
    auth: true,
    permissions: ["reseller:read"],
    feature: "reseller",
  },
  async (_req, ctx) => {
    const page = Number(ctx.query.page ?? 1);
    const limit = Number(ctx.query.limit ?? 20);
    const result = await getResellerCommissionService().listCommissions({
      tenantId: getTenantId(ctx),
      resellerId: ctx.params.id,
      period:
        typeof ctx.query.period === "string" ? ctx.query.period : undefined,
      skip: (page - 1) * limit,
      take: limit,
    });
    return apiPaginated(result.items.map(toCommissionDTO), {
      page,
      limit,
      total: result.total,
    });
  },
);
