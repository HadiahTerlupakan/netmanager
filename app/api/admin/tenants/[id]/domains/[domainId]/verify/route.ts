import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { TenantDomainService } from "@/modules/tenant";

const domainService = new TenantDomainService();

/**
 * POST /api/admin/tenants/[id]/domains/[domainId]/verify - Trigger manual DNS verify (super admin only)
 */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const { domainId } = ctx.params;
  const result = await domainService.manualVerify(domainId);
  return apiSuccess(result);
});
