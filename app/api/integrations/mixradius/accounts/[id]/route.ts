import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  mixRadiusConfigRepo,
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

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);

  if (!isSuper) {
    const permissions = await getUserPermissions(user.id);
    const hasAccess =
      permissions.includes("mixradius:update") || permissions.includes("*");
    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk update MixRadius",
      );
    }
  }

  const body = await req.json();
  const { id } = ctx.params;

  if (!id)
    return apiError("ID akun wajib disertakan", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });

  const updatePayload: Record<string, unknown> = {};
  const hasBaseUrlInput =
    typeof body.apiUrl === "string" || typeof body.baseUrl === "string";

  if (typeof body.name === "string") {
    updatePayload.name = body.name || "Default";
  }

  if (hasBaseUrlInput) {
    const rawBaseUrl =
      typeof body.apiUrl === "string" ? body.apiUrl : body.baseUrl;
    const configInput = IntegrationFactory.createMixRadiusConfig({
      name: typeof body.name === "string" ? body.name || "Default" : "Default",
      baseUrl: rawBaseUrl,
      username: typeof body.username === "string" ? body.username : "",
      password: typeof body.password === "string" ? body.password : "",
    });

    const validation = IntegrationFactory.validateUrl(configInput.baseUrl);
    if (!validation.isValid) {
      return apiError(
        validation.error || "API URL tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    updatePayload.apiUrl = configInput.baseUrl;
  }

  if (typeof body.username === "string") {
    updatePayload.username = body.username;
  }

  if (typeof body.password === "string" && body.password.trim()) {
    updatePayload.password = body.password;
  }

  if (body.apiKey !== undefined) {
    updatePayload.apiKey = body.apiKey;
  }

  if (body.isDefault !== undefined) {
    updatePayload.isDefault = body.isDefault;
  } else if (body.isActive !== undefined) {
    updatePayload.isDefault = body.isActive;
  }

  if (isSuper) {
    const updatedConfig = await mixRadiusConfigRepo.updateConfig(
      id,
      updatePayload,
    );

    await logger.logActivity({
      userId: user.id,
      action: "UPDATE",
      subject: "mixradius_config",
      details: { id, changes: body },
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    });
    return apiSuccess(updatedConfig);
  }

  if (!user.tenantId) {
    return apiError(
      "Tenant MixRadius tidak ditemukan untuk user ini",
      ErrorCodes.VALIDATION_ERROR,
      {
        status: 400,
      },
    );
  }

  const updatedConfig = await mixRadiusConfigRepo.updateConfigForTenant(
    id,
    user.tenantId,
    updatePayload,
  );

  await logger.logActivity({
    userId: user.id,
    action: "UPDATE",
    subject: "mixradius_config",
    details: { id, changes: body },
    ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    userAgent: req.headers.get("user-agent") || "unknown",
  });
  return apiSuccess(updatedConfig);
});

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);

  if (!isSuper) {
    const permissions = await getUserPermissions(user.id);
    const hasAccess =
      permissions.includes("mixradius:delete") || permissions.includes("*");
    if (!hasAccess) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk delete MixRadius",
      );
    }
  }

  const { id } = ctx.params;

  if (!id)
    return apiError("ID akun wajib disertakan", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });

  if (isSuper) {
    await mixRadiusConfigRepo.deleteConfig(id);
  } else {
    if (!user.tenantId) {
      return apiError(
        "Tenant MixRadius tidak ditemukan untuk user ini",
        ErrorCodes.VALIDATION_ERROR,
        {
          status: 400,
        },
      );
    }

    await mixRadiusConfigRepo.deleteConfigForTenant(id, user.tenantId);
  }

  await logger.logActivity({
    userId: user.id,
    action: "DELETE",
    subject: "mixradius_config",
    details: { id },
    ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    userAgent: req.headers.get("user-agent") || "unknown",
  });

  return apiSuccess({ success: true });
});
