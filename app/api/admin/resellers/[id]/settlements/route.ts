import { apiPaginated, apiSuccess, createHandler } from "@/lib/api";
import {
  createResellerSettlementSchema,
  getResellerCommissionService,
  resellerCommissionSummarySchema,
  toSettlementDTO,
} from "@/modules/reseller";

function getTenantId(ctx: {
  session: { user: { tenantId?: string | null } } | null;
}) {
  return ctx.session?.user.tenantId ?? null;
}

export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const periodStart = ctx.query.periodStart;
    const periodEnd = ctx.query.periodEnd;
    if (typeof periodStart === "string" && typeof periodEnd === "string") {
      const query = resellerCommissionSummarySchema.parse({
        periodStart,
        periodEnd,
      });
      const summary = await getResellerCommissionService().getSummary({
        tenantId: getTenantId(ctx),
        resellerId: ctx.params.id,
        periodStart: query.periodStart,
        periodEnd: query.periodEnd,
      });
      return apiSuccess(summary);
    }

    const page = Number(ctx.query.page ?? 1);
    const limit = Number(ctx.query.limit ?? 20);
    const result = await getResellerCommissionService().listSettlements({
      tenantId: getTenantId(ctx),
      resellerId: ctx.params.id,
      skip: (page - 1) * limit,
      take: limit,
    });
    return apiPaginated(result.items.map(toSettlementDTO), {
      page,
      limit,
      total: result.total,
    });
  },
);

export const POST = createHandler(
  {
    auth: true,
    permissions: ["reseller:update"],
    schema: createResellerSettlementSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    const settlement = await getResellerCommissionService().createSettlement({
      tenantId: getTenantId(ctx),
      resellerId: ctx.params.id,
      periodStart: ctx.validated.periodStart,
      periodEnd: ctx.validated.periodEnd,
      notes: ctx.validated.notes,
    });
    return apiSuccess(toSettlementDTO(settlement), { status: 201 });
  },
);
