import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
  createHandler,
} from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { RouterReconfigureRouteService } from "@/modules/network";
import { isSuperAdmin } from "@/lib/auth";

const routerReconfigureRouteService = new RouterReconfigureRouteService();

/** Reconfigure router MikroTik terpilih menggunakan provisioning service. */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("mikrotik:update"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const body = (await req.json()) as { routerIds?: unknown };
  const routerIds = body.routerIds;
  if (!Array.isArray(routerIds) || routerIds.length === 0) {
    return apiError("No routers selected", ErrorCodes.VALIDATION_ERROR, {
      status: 400,
    });
  }

  try {
    const restrictedToOwnSite =
      (await hasPermission("mikrotik:site_only")) &&
      !isSuperAdmin(ctx.session?.user);
    const result = await routerReconfigureRouteService.reconfigureRouters(
      routerIds,
      {
        tenantId: ctx.session?.user.tenantId,
        userId: ctx.session?.user.id || "",
        role: ctx.session?.user.role,
        restrictedToOwnSite,
      },
    );

    return apiSuccess(result);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) {
      return ApiErrors.forbidden(error.message.replace("FORBIDDEN:", ""));
    }

    if (error instanceof Error && error.message.startsWith("NOT_FOUND:")) {
      return ApiErrors.notFound(error.message.replace("NOT_FOUND:", ""));
    }

    throw error;
  }
});
