import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { TenantDomainService } from "@/modules/tenant";
import { prisma } from "@/modules/database";
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

  // Field `Tenant.domain` adalah peninggalan: ia membuat resolusi tenant
  // menemukan host, tetapi tidak pernah memicu verifikasi maupun SSL. Ikut
  // dikirim supaya halaman domain bisa menyuruh operator mendaftarkannya ulang.
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { domain: true },
  });

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
    cnameTarget: baseDomain,
    subdomain: `${domain.slug}.${baseDomain}`,
    legacyDomain: tenant?.domain ?? null,
    instructions: domain.domain
      ? `Arahkan CNAME ${domain.domain} ke ${baseDomain}, atau A record ke IP yang sama dengan ${baseDomain} bila domainnya apex`
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
      return ApiErrors.notFound("Domain tidak ditemukan untuk tenant ini");
    }

    const updated = await domainService.setCustomDomain(
      existing.id,
      ctx.validated.domain,
    );
    return apiSuccess(updated);
  },
);
