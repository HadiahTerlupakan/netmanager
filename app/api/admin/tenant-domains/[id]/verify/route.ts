import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { TenantDomainService } from "@/modules/tenant";

const domainService = new TenantDomainService();

/**
 * POST /api/admin/tenant-domains/[id]/verify - Manually verify a domain (super admin only)
 */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const { id } = ctx.params;
  const result = await domainService.manualVerify(id);
  return apiSuccess(result);
});
