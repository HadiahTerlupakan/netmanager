import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  getMixRadiusConfigService,
  IntegrationFactory,
} from "@/modules/integrations";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const configService = getMixRadiusConfigService();
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

    const tenantConfigs = await configService.getAllConfigsByTenant(
      user.tenantId,
    );
    return apiSuccess(tenantConfigs);
  }

  const configs = await configService.getAllConfigs();
  return apiSuccess(configs);
});

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const configService = getMixRadiusConfigService();
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
  const name = body.name || "Default";
  const rawBaseUrl = body.apiUrl || body.baseUrl || "";
  const username = body.username;
  const password = body.password;
  const isDefault =
    body.isDefault !== undefined
      ? body.isDefault
      : body.isActive !== undefined
        ? body.isActive
        : false;
  const apiKey = body.apiKey || "default-api-key";

  const missingFields: string[] = [];
  if (!rawBaseUrl.trim()) missingFields.push("API URL");
  if (!username) missingFields.push("Username");
  if (!password) missingFields.push("Password");

  if (missingFields.length > 0) {
    return apiError(
      `Data berikut wajib diisi: ${missingFields.join(", ")}`,
      ErrorCodes.VALIDATION_ERROR,
      { details: { missingFields }, status: 400 },
    );
  }

  const configInput = IntegrationFactory.createMixRadiusConfig({
    name,
    baseUrl: rawBaseUrl,
    username,
    password,
  });
  const validation = IntegrationFactory.validateUrl(configInput.baseUrl);
  if (!validation.isValid) {
    return apiError(
      validation.error || "API URL tidak valid",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  if (!user.tenantId) {
    return apiError(
      "Tenant MixRadius tidak ditemukan untuk user ini",
      ErrorCodes.VALIDATION_ERROR,
      { status: 400 },
    );
  }

  const newConfig = await configService.createConfig({
    name: configInput.name,
    apiUrl: configInput.baseUrl,
    apiKey,
    username: configInput.username,
    password: configInput.password,
    isDefault: isDefault || false,
    lastSyncedAt: null,
    tenantId: user.tenantId,
  });

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
