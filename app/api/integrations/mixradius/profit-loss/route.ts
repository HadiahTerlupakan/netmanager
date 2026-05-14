import { isSuperAdmin } from "@/lib/auth";
import {
  getMixRadiusAccessService,
  MixRadiusConfigError,
  MixRadiusProfitLossService,
} from "@/modules/integrations";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";

export const dynamic = "force-dynamic";

const mixRadiusProfitLossService = new MixRadiusProfitLossService();

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: isSuperAdmin(user),
    requiredPermissions: ["mixradius_profit_loss:read", "mixradius:read"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Butuh permission: mixradius_profit_loss:read",
    );
  }

  const { searchParams } = req.nextUrl;
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const siteId = searchParams.get("siteId");

  try {
    const report = await mixRadiusProfitLossService.getReport({
      startDate: startDateParam,
      endDate: endDateParam,
      siteId,
    });

    return apiSuccess(report);
  } catch (error: unknown) {
    if (error instanceof MixRadiusConfigError) {
      return apiSuccess(
        mixRadiusProfitLossService.getConfigErrorResponse(error),
      );
    }

    throw error;
  }
});
