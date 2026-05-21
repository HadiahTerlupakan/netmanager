import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { TenantDomainService } from "@/modules/tenant";
import { updateDomainSchema } from "@/modules/tenant";

const domainService = new TenantDomainService();

/**
 * GET /api/admin/tenants/[id]/domains - Get domain config for a tenant (super admin only)
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const { id } = ctx.params;
  const domain = await domainService.getByTenantId(id);
  if (!domain) {
    return apiSuccess(null);
  }

  const baseDomain = process.env.DOMAIN || "radpro.id";
  return apiSuccess({
    id: domain.id,
    domain: domain.domain,
    slug: domain.slug,
    status: domain.status,
    sslStatus: domain.sslStatus,
    verifiedAt: domain.verifiedAt?.toISOString() || null,
    cnameTarget: "radpro.id",
    subdomain: `${domain.slug}.${baseDomain}`,
    instructions: domain.domain
      ? `Arahkan CNAME ${domain.domain} ke radpro.id`
      : null,
  });
});

/**
 * POST /api/admin/tenants/[id]/domains - Set custom domain for a tenant (super admin only)
 */
export const POST = createHandler(
  { auth: true, schema: updateDomainSchema },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const { id } = ctx.params;
    const existing = await domainService.getByTenantId(id);
    if (!existing) {
      return ApiErrors.notFound("TenantDomain not found for this tenant");
    }

    const updated = await domainService.setCustomDomain(
      existing.id,
      ctx.validated.domain,
    );
    return apiSuccess(updated);
  },
);
