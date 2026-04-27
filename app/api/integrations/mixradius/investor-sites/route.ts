import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/auth";
import { MixRadiusInvestorSiteService } from "@/modules/integrations";

const mixRadiusInvestorSiteService = new MixRadiusInvestorSiteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
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
    const sites = await mixRadiusInvestorSiteService.getSites(
      isSuper ? undefined : user.tenantId,
    );

    return apiSuccess(sites);
  } catch (e) {
    console.error("Error fetching MixRadiusInvestorSite:", e);
    return ApiErrors.internalError("Gagal mengambil data Site Investor");
  }
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  const isSuper = isSuperAdmin(user);
  const canCreate = await hasPermission("mixradius_sites:create");

  if (!isSuper && !canCreate) {
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

    const newSite = await mixRadiusInvestorSiteService.createSite({
      name,
      owners,
      isActive,
      tenantId: isSuper ? undefined : user.tenantId,
    });

    return apiSuccess(newSite);
  } catch (e) {
    console.error("Error creating MixRadiusInvestorSite:", e);
    return ApiErrors.internalError("Gagal membuat Site Investor");
  }
});
