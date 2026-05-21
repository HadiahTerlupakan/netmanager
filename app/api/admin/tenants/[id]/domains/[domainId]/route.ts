import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { TenantDomainService } from "@/modules/tenant";

const domainService = new TenantDomainService();

/**
 * DELETE /api/admin/tenants/[id]/domains/[domainId] - Remove custom domain (super admin only)
 */
export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const { domainId } = ctx.params;
  await domainService.removeCustomDomain(domainId);
  return apiSuccess({ removed: true });
});
