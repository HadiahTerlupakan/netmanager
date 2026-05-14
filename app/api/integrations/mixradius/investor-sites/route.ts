import { logger } from "@/lib/logger";
import { createHandler, ApiErrors, apiSuccess } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import {
  getMixRadiusAccessService,
  MixRadiusInvestorSiteService,
  investorSiteSchema,
} from "@/modules/integrations";

const mixRadiusInvestorSiteService = new MixRadiusInvestorSiteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
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
    const sites = await mixRadiusInvestorSiteService.getSites(
      isSuper ? undefined : user.tenantId,
    );

    return apiSuccess(sites);
  } catch (e) {
    logger.error("Error fetching MixRadiusInvestorSite:", e);
    return ApiErrors.internalError("Gagal mengambil data Site Investor");
  }
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuper,
    requiredPermissions: ["mixradius_sites:create", "mixradius:create"],
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

    const newSite = await mixRadiusInvestorSiteService.createSite({
      name,
      owners,
      isActive,
      tenantId: isSuper ? undefined : user.tenantId,
    });

    return apiSuccess(newSite);
  } catch (e) {
    logger.error("Error creating MixRadiusInvestorSite:", e);
    return ApiErrors.internalError("Gagal membuat Site Investor");
  }
});
