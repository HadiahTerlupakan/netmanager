import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  getResellerSettlementLifecycleService,
  RESELLER_FINANCE_PERMISSIONS,
  toSettlementDTO,
} from "@/modules/reseller";

/**
 * Setujui settlement PENDING → APPROVED. Idempoten untuk settlement yang
 * sudah disetujui; 409 bila sudah dibayar.
 */
export const POST = createHandler(
  {
    auth: true,
    permissionsAll: [...RESELLER_FINANCE_PERMISSIONS],
    feature: "reseller",
  },
  async (_req, ctx) => {
    const settlement = await getResellerSettlementLifecycleService().approve({
      tenantId: requireSessionTenantId(ctx),
      resellerId: ctx.params.id,
      settlementId: ctx.params.settlementId,
      actorId: ctx.session?.user.id ?? null,
    });
    return apiSuccess(toSettlementDTO(settlement));
  },
);
