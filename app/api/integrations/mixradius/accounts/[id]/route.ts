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

  if (!isSuper && !user.tenantId) {
    return apiError(
      "Tenant MixRadius tidak ditemukan untuk user ini",
      ErrorCodes.VALIDATION_ERROR,
      {
        status: 400,
      },
    );
  }

  let updatedConfig;

  try {
    updatedConfig = await mixRadiusConfigService.updateConfig(
      id,
      body,
      isSuper ? undefined : user.tenantId,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
  }

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

  if (!isSuper && !user.tenantId) {
    return apiError(
      "Tenant MixRadius tidak ditemukan untuk user ini",
      ErrorCodes.VALIDATION_ERROR,
      {
        status: 400,
      },
    );
  }

  await mixRadiusConfigService.deleteConfig(
    id,
    isSuper ? undefined : user.tenantId,
  );

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
