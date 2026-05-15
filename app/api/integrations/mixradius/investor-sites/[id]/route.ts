import { logger } from "@/lib/logger";
import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import {
  getMixRadiusAccessService,
  MixRadiusInvestorSiteService,
  investorSiteSchema,
} from "@/modules/integrations";
import { isRouteServiceError } from "@/lib/api/route-service-error";

const mixRadiusInvestorSiteService = new MixRadiusInvestorSiteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const { id } = ctx.params;
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuper,
    requiredPermissions: ["mixradius_sites:read", "mixradius:read"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  if (!isSuper && !user.tenantId) {
    return ApiErrors.badRequest(
      "Tenant MixRadius tidak ditemukan untuk user ini",
    );
  }

  try {
    const site = await mixRadiusInvestorSiteService.getSite(
      id,
      isSuper ? undefined : user.tenantId,
    );

    return apiSuccess(site);
  } catch (e) {
    if (isRouteServiceError(e) && e.status === 404) {
      return ApiErrors.notFound(e.message);
    }
    logger.error("Error fetching MixRadiusInvestorSite detail:", e);
    return ApiErrors.internalError("Gagal mengambil detail Site Investor");
  }
});

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const { id } = ctx.params;
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuper,
    requiredPermissions: ["mixradius_sites:update", "mixradius:update"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  if (!isSuper && !user.tenantId) {
    return ApiErrors.badRequest(
      "Tenant MixRadius tidak ditemukan untuk user ini",
    );
  }

  try {
    const body = await req.json();
    const parsed = investorSiteSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Data tidak valid";
      return ApiErrors.badRequest(firstError);
    }

    const { name, owners, isActive } = parsed.data;

    const updated = await mixRadiusInvestorSiteService.updateSite(id, {
      name,
      owners,
      isActive,
      tenantId: isSuper ? undefined : user.tenantId,
    });

    return apiSuccess(updated);
  } catch (e) {
    if (isRouteServiceError(e) && e.status === 404) {
      return ApiErrors.notFound(e.message);
    }
    logger.error("Error updating MixRadiusInvestorSite:", e);
    return ApiErrors.internalError("Gagal memperbarui Site Investor");
  }
});

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const { id } = ctx.params;
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuper,
    requiredPermissions: ["mixradius_sites:delete", "mixradius:delete"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  if (!isSuper && !user.tenantId) {
    return ApiErrors.badRequest(
      "Tenant MixRadius tidak ditemukan untuk user ini",
    );
  }

  try {
    await mixRadiusInvestorSiteService.deleteSite(
      id,
      isSuper ? undefined : user.tenantId,
    );

    return apiSuccess({ success: true });
  } catch (e) {
    if (isRouteServiceError(e)) {
      return ApiErrors.internalError(e.message);
    }
    logger.error("Error deleting MixRadiusInvestorSite:", e);
    return ApiErrors.internalError(
      "Gagal menghapus Site Investor. Mungkin data sedang digunakan.",
    );
  }
});
