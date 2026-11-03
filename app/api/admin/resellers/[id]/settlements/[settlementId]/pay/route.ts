import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  getResellerSettlementLifecycleService,
  payResellerSettlementSchema,
  RESELLER_FINANCE_PERMISSIONS,
  toSettlementDTO,
} from "@/modules/reseller";

/**
 * Tandai settlement APPROVED → PAID dari rekening Kas & Bank terpilih; jurnal
 * Dr Utang Komisi Reseller / Cr Kas/Bank dibuat lewat event. Idempoten untuk
 * settlement yang sudah dibayar; 409 bila belum disetujui.
 */
export const POST = createHandler(
  {
    auth: true,
    permissionsAll: [...RESELLER_FINANCE_PERMISSIONS],
    schema: payResellerSettlementSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    const settlement = await getResellerSettlementLifecycleService().markPaid({
      tenantId: requireSessionTenantId(ctx),
      resellerId: ctx.params.id,
      settlementId: ctx.params.settlementId,
      actorId: ctx.session?.user.id ?? null,
      paidAt: ctx.validated.paidAt,
      paymentMethod: ctx.validated.paymentMethod,
      paymentReference: ctx.validated.paymentReference,
      accountId: ctx.validated.accountId,
    });
    return apiSuccess(toSettlementDTO(settlement));
  },
);
