import { isSuperAdmin } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  getMixRadiusAccessService,
  getMixRadiusConfigService,
  mixRadiusConfigCreateSchema,
} from "@/modules/integrations";

const TENANT_NOT_FOUND_MESSAGE =
  "Tenant MixRadius tidak ditemukan untuk user ini";

const mixRadiusConfigService = getMixRadiusConfigService();

export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const userIsSuperAdmin = isSuperAdmin(user);
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: userIsSuperAdmin,
    requiredPermissions: ["mixradius_accounts:read", "mixradius:read"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: mixradius_accounts:read",
    );
  }

  if (!userIsSuperAdmin) {
    if (!user.tenantId) {
      return apiError(TENANT_NOT_FOUND_MESSAGE, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
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
  const userIsSuperAdmin = isSuperAdmin(user);
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: userIsSuperAdmin,
    requiredPermissions: ["mixradius_accounts:create", "mixradius:create"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: mixradius_accounts:create",
    );
  }

  const body = await req.json();

  const parsed = mixRadiusConfigCreateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Data tidak valid";
    return apiError(firstError, ErrorCodes.VALIDATION_ERROR, { status: 400 });
  }

  const targetTenantId =
    userIsSuperAdmin && body.tenantId ? body.tenantId : user.tenantId;

  if (!targetTenantId) {
    return apiError(TENANT_NOT_FOUND_MESSAGE, ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  let newConfig;

  try {
    newConfig = await mixRadiusConfigService.createConfig(
      targetTenantId,
      parsed.data,
    );
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
