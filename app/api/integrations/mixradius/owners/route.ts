import { getMixRadiusService } from "@/modules/integrations";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  ApiErrors,
  ErrorCodes,
  createHandler,
} from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const isSuper = isSuperAdmin(user);
  const permissions = await getUserPermissions(user.id);
  const hasAccess =
    isSuper ||
    permissions.includes("*") ||
    permissions.includes("mixradius:read");

  if (!hasAccess) {
    return ApiErrors.forbidden();
  }

  try {
    const service = getMixRadiusService();
    const owners = await service.getOwnersWithIds();

    return apiSuccess(owners);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "MixRadiusConfigError") {
      return apiError(error.message, ErrorCodes.INVALID_STATUS, {
        status: 400,
        details: { isConfigError: true },
      });
    }
    throw error;
  }
});
