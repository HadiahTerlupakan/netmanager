import { logger } from "@/lib/logger";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { AdminTenantRouteService } from "@/modules/admin";

const tenantService = new AdminTenantRouteService();

/**
 * GET /api/admin/tenants - List tenants (super admin only)
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const activeOnly = req.nextUrl.searchParams.get("active") === "true";
  const tenants = await tenantService.getTenants({ activeOnly });
  return apiSuccess(tenants);
});

/**
 * POST /api/admin/tenants - Create tenant (super admin only)
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!isSuperAdmin(ctx.session?.user)) {
    return ApiErrors.forbidden();
  }

  const body = await req.json();
  const { name, domain, isActive } = body;

  if (!name) {
    return ApiErrors.badRequest("Name is required");
  }

  try {
    const tenant = await tenantService.createTenant({ name, domain, isActive });
    return apiSuccess(tenant, {
      status: 201,
      message: `Tenant ${tenant.name} berhasil dibuat dengan data default.`,
    });
  } catch (error) {
    logger.error("[TENANT_POST]", error);
    return ApiErrors.internalError("Failed to create tenant");
  }
});
