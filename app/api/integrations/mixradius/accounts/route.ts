import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import { getMixRadiusConfigService } from "@/modules/integrations";

const mixRadiusConfigService = getMixRadiusConfigService();

export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);

  if (!isSuper) {
    const permissions = await getUserPermissions(user.id);
    const hasAccess =
      permissions.includes("mixradius_accounts:read") ||
      permissions.includes("mixradius:read") ||
      permissions.includes("*");
    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Akses ditolak. Anda memerlukan permission: mixradius_accounts:read",
      );
    }

    if (!user.tenantId) {
      return apiError(
        "Tenant MixRadius tidak ditemukan untuk user ini",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const tenantConfigs = await mixRadiusConfigService.getConfigs(
      user.tenantId,
    );
    return apiSuccess(tenantConfigs);
  }

  const configs = await mixRadiusConfigService.getConfigs();
  return apiSuccess(configs);
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);

  if (!isSuper) {
    const permissions = await getUserPermissions(user.id);
    const hasAccess =
      permissions.includes("mixradius_accounts:create") ||
      permissions.includes("mixradius:create") ||
      permissions.includes("*");
    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Akses ditolak. Anda memerlukan permission: mixradius_accounts:create",
      );
    }
  }

  const body = await req.json();

  if (!user.tenantId) {
    return apiError(
      "Tenant MixRadius tidak ditemukan untuk user ini",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  let newConfig;

  try {
    newConfig = await mixRadiusConfigService.createConfig(user.tenantId, body);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
  }

  await logger.logActivity({
    userId: user.id,
    action: "CREATE",
    subject: "mixradius_config",
    details: { id: newConfig.id, apiUrl: newConfig.apiUrl },
    ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    userAgent: req.headers.get("user-agent") || "unknown",
  });

  return apiSuccess(newConfig, { status: 201 });
});
