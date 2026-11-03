import { apiSuccess, createHandler, requireSessionTenantId } from "@/lib/api";
import {
  createResellerCommissionRuleSchema,
  getResellerCommissionRuleService,
  RESELLER_FINANCE_PERMISSIONS,
  toCommissionRuleDTO,
} from "@/modules/reseller";

/** Daftar aturan komisi reseller (aktif & nonaktif). */
export const GET = createHandler(
  { auth: true, permissions: ["reseller:read"], feature: "reseller" },
  async (_req, ctx) => {
    const rules = await getResellerCommissionRuleService().listRules(
      requireSessionTenantId(ctx),
      ctx.params.id,
    );
    return apiSuccess(rules.map(toCommissionRuleDTO));
  },
);

/** Buat aturan komisi: menentukan beban komisi, jadi butuh izin keuangan juga. */
export const POST = createHandler(
  {
    auth: true,
    permissionsAll: [...RESELLER_FINANCE_PERMISSIONS],
    schema: createResellerCommissionRuleSchema,
    feature: "reseller",
  },
  async (_req, ctx) => {
    const rule = await getResellerCommissionRuleService().createRule(
      requireSessionTenantId(ctx),
      ctx.params.id,
      ctx.validated,
    );
    return apiSuccess(toCommissionRuleDTO(rule), { status: 201 });
  },
);
