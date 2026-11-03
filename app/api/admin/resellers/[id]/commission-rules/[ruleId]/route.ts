import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  getResellerCommissionRuleService,
  RESELLER_FINANCE_PERMISSIONS,
  toCommissionRuleDTO,
  updateResellerCommissionRuleSchema,
} from "@/modules/reseller";

/** Ubah nilai, rentang berlaku, atau status aturan komisi. */
export const PATCH = createHandler(
  {
    auth: true,
    permissionsAll: [...RESELLER_FINANCE_PERMISSIONS],
    schema: updateResellerCommissionRuleSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    const rule = await getResellerCommissionRuleService().updateRule(
      requireSessionTenantId(ctx),
      ctx.params.id,
      ctx.params.ruleId,
      ctx.validated,
    );
    return apiSuccess(toCommissionRuleDTO(rule));
  },
);

/**
 * Nonaktifkan aturan komisi. Aturan tidak dihapus permanen karena komisi
 * yang sudah terbit merujuknya.
 */
export const DELETE = createHandler(
  {
    auth: true,
    permissionsAll: [...RESELLER_FINANCE_PERMISSIONS],
    feature: "reseller",
  },
  async (_req, ctx) => {
    const rule = await getResellerCommissionRuleService().deactivateRule(
      requireSessionTenantId(ctx),
      ctx.params.id,
      ctx.params.ruleId,
    );
    return apiSuccess(toCommissionRuleDTO(rule));
  },
);
