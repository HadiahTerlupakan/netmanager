import { isSuperAdmin } from "@/lib/auth";
import {
  getMixRadiusAccessService,
  getMixRadiusSyncService,
} from "@/modules/integrations";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius:read"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki izin untuk mengakses statistik MixRadius",
    );
  }

  const { searchParams } = req.nextUrl;
  const groupId = searchParams.get("groupId") || undefined;

  try {
    const stats = await getMixRadiusSyncService().getNPLStatistics(groupId);
    return apiSuccess(stats);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "MixRadiusConfigError") {
      return apiSuccess({
        error: error.message,
        isConfigError: true,
        under30: { count: 0, sum: 0 },
        between30And60: { count: 0, sum: 0 },
        between60And90: { count: 0, sum: 0 },
        over90: { count: 0, sum: 0 },
        totalCustomers: 0,
      });
    }
    throw error;
  }
});
