import { logger } from "@/lib/logger";
import {
  isRestrictedToOwnRouterSite,
  MikroTikRouterService,
} from "@/modules/network";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";

export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("mikrotik:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);
  try {
    const count = await new MikroTikRouterService().checkRouterStatus({
      tenantId: user.tenantId,
      userId: user.id,
      isSuperAdmin: isSuper,
      restrictedToOwnSite: isRestrictedToOwnRouterSite({
        isSuperAdmin: isSuper,
        permissions: ctx.permissions,
      }),
    });
    return apiSuccess({
      success: true,
      message: `Status check completed. Updated ${count} routers.`,
      count,
    });
  } catch (error: unknown) {
    logger.error("Error checking MikroTik router status:", error);
    const message =
      error instanceof Error ? error.message : "Failed to check router status";
    return ApiErrors.internalError(message);
  }
});
