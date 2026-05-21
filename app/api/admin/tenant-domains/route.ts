import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { TenantDomainService } from "@/modules/tenant";

const domainService = new TenantDomainService();

/**
 * GET /api/admin/tenant-domains - List all tenant domains (super admin only)
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const domains = await domainService.listAll();
  const baseDomain = process.env.DOMAIN || "radpro.id";

  const response = domains.map((d) => ({
    id: d.id,
    tenantId: d.tenantId,
    tenantName: d.tenant.name,
    domain: d.domain,
    slug: d.slug,
    status: d.status,
    sslStatus: d.sslStatus,
    verifiedAt: d.verifiedAt?.toISOString() || null,
    cnameTarget: "radpro.id",
    subdomain: `${d.slug}.${baseDomain}`,
  }));

  return apiSuccess(response);
});
