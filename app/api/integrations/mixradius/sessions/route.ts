import { isSuperAdmin } from "@/lib/auth";
import {
  getMixRadiusAccessService,
  getMixRadiusService,
} from "@/modules/integrations";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius:read"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden("Anda tidak memiliki akses ke data MixRadius");
  }

  try {
    const service = getMixRadiusService();
    const activeSessions = await service.fetchActiveSessionsPPP();

    return apiSuccess({
      count: activeSessions.size,
      usernames: Array.from(activeSessions).slice(0, 50),
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "MixRadiusConfigError") {
      return apiSuccess({
        error: error.message,
        isConfigError: true,
        count: 0,
        usernames: [],
      });
    }
    throw error;
  }
});
