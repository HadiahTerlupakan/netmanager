import { isSuperAdmin } from "@/lib/auth";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getMixRadiusAccessService,
  getMixRadiusService,
} from "@/modules/integrations";

export const dynamic = "force-dynamic";

export const POST = createHandler({ auth: true }, async (_req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius_accounts:read", "mixradius:read"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden("Anda tidak memiliki akses ke data MixRadius");
  }

  try {
    const service = getMixRadiusService();
    await service.login();
    return apiSuccess({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return apiSuccess({ success: false, error: message });
  }
});
