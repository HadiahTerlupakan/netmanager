import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { TenantDomainService } from "@/modules/tenant";

const domainService = new TenantDomainService();

/**
 * POST /api/admin/tenant-domains/[id]/disable - Disable a domain (super admin only)
 */
export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const { id } = ctx.params;
  await domainService.disableDomain(id);
  return apiSuccess({ disabled: true });
});
