import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/auth";
import { MixRadiusInvestorSiteService } from "@/modules/integrations";
import { isRouteServiceError } from "@/modules/finance";

const mixRadiusInvestorSiteService = new MixRadiusInvestorSiteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const { id } = ctx.params;
  const user = ctx.session!.user;

  const isSuper = isSuperAdmin(user);
  const canRead = await hasPermission("mixradius_sites:read");

  if (!isSuper && !canRead) {
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
    console.error("Error fetching MixRadiusInvestorSite detail:", e);
    return ApiErrors.internalError("Gagal mengambil detail Site Investor");
  }
});

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const { id } = ctx.params;
  const user = ctx.session!.user;

  const isSuper = isSuperAdmin(user);
  const canUpdate = await hasPermission("mixradius_sites:update");

  if (!isSuper && !canUpdate) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  if (!isSuper && !user.tenantId) {
    return ApiErrors.badRequest(
      "Tenant MixRadius tidak ditemukan untuk user ini",
    );
  }

  try {
    const body = await req.json();
    const { name, owners, isActive } = body;

    if (!name || typeof name !== "string") {
      return ApiErrors.badRequest("Nama belum diisi");
    }

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
    console.error("Error updating MixRadiusInvestorSite:", e);
    return ApiErrors.internalError("Gagal memperbarui Site Investor");
  }
});

export const DELETE = createHandler({ auth: true }, async (_req, ctx) => {
  const { id } = ctx.params;
  const user = ctx.session!.user;

  const isSuper = isSuperAdmin(user);
  const canDelete = await hasPermission("mixradius_sites:delete");

  if (!isSuper && !canDelete) {
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
    console.error("Error deleting MixRadiusInvestorSite:", e);
    return ApiErrors.internalError(
      "Gagal menghapus Site Investor. Mungkin data sedang digunakan.",
    );
  }
});
