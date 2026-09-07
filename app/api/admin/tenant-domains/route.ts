import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { prisma } from "@/modules/database";
import { isSuperAdmin } from "@/lib/auth";
import {
  TenantDomainService,
  createTenantDomainSchema,
} from "@/modules/tenant";

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
    cnameTarget: baseDomain,
    subdomain: `${d.slug}.${baseDomain}`,
  }));

  return apiSuccess(response);
});

/**
 * POST /api/admin/tenant-domains - Siapkan baris domain untuk sebuah tenant
 * (super admin only).
 *
 * Idempoten: tenant yang sudah punya baris dikembalikan apa adanya, sehingga
 * endpoint ini juga berlaku sebagai perbaikan untuk tenant lama yang dibuat
 * sebelum baris domain ikut dibentuk otomatis.
 */
export const POST = createHandler(
  { auth: true, schema: createTenantDomainSchema },
  async (_req, ctx) => {
    if (!isSuperAdmin(ctx.session?.user)) {
      return ApiErrors.forbidden();
    }

    const { tenantId, slug, domain } = ctx.validated;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    if (!tenant) {
      return ApiErrors.notFound("Tenant tidak ditemukan");
    }

    const record = slug
      ? await domainService.createForTenant(tenantId, slug, domain)
      : await domainService.ensureForTenant(tenantId, tenant.name);

    return apiSuccess(record);
  },
);
