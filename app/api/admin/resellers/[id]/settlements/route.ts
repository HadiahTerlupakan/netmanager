import { apiPaginated, apiSuccess, createHandler } from "@/lib/api";
import {
  createResellerSettlementSchema,
  getResellerCommissionService,
  listResellerSettlementSchema,
  RESELLER_FINANCE_PERMISSIONS,
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
    const isSummaryRequest =
      ctx.query.periodStart !== undefined || ctx.query.periodEnd !== undefined;
    if (isSummaryRequest) {
      const query = resellerCommissionSummarySchema.parse(ctx.query);
      const summary = await getResellerCommissionService().getSummary({
        tenantId: getTenantId(ctx),
        resellerId: ctx.params.id,
        periodStart: query.periodStart,
        periodEnd: query.periodEnd,
      });
      return apiSuccess(summary);
    }

    const { page, limit } = listResellerSettlementSchema.parse(ctx.query);
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
    // Settlement mengunci komisi ACCRUED menjadi SETTLED untuk dibayarkan:
    // aksi keuangan, jadi izin reseller DAN izin transaksi keuangan.
    permissionsAll: [...RESELLER_FINANCE_PERMISSIONS],
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
