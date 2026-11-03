import { apiPaginated, createHandler } from "@/lib/api";
import {
  getResellerCommissionReversalService,
  listResellerCommissionAdjustmentSchema,
  toCommissionAdjustmentDTO,
} from "@/modules/reseller";

function getTenantId(ctx: {
  session: { user: { tenantId?: string | null } } | null;
}) {
  return ctx.session?.user.tenantId ?? null;
}

/** Koreksi (clawback) komisi reseller yang sudah dibayar, terbaru dulu. */
export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const { page, limit } = listResellerCommissionAdjustmentSchema.parse(
      ctx.query,
    );
    const result = await getResellerCommissionReversalService().listAdjustments(
      {
        tenantId: getTenantId(ctx),
        resellerId: ctx.params.id,
        skip: (page - 1) * limit,
        take: limit,
      },
    );
    return apiPaginated(result.items.map(toCommissionAdjustmentDTO), {
      page,
      limit,
      total: result.total,
    });
  },
);
