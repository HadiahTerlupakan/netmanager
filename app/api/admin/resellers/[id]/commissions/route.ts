import { apiPaginated, createHandler } from "@/lib/api";
import {
  getResellerCommissionService,
  listResellerCommissionSchema,
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
    const query = listResellerCommissionSchema.parse(ctx.query);
    const result = await getResellerCommissionService().listCommissions({
      tenantId: getTenantId(ctx),
      resellerId: ctx.params.id,
      period: query.period,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return apiPaginated(result.items.map(toCommissionDTO), {
      page: query.page,
      limit: query.limit,
      total: result.total,
    });
  },
);
