import { logger } from "@/lib/logger";
import {
  getMixRadiusAccessService,
  getMixRadiusSyncService,
} from "@/modules/integrations";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const { startDate, endDate } = await req.json();

  const hasAccess = await getMixRadiusAccessService().canAccess({
    userId: user.id,
    isSuperAdmin: user.role === "SUPER_ADMIN",
    requiredPermissions: ["mixradius:calculate", "mixradius_income:calculate"],
  });

  if (!hasAccess) {
    return ApiErrors.forbidden(
      "Akses ditolak. Anda memerlukan permission: mixradius:calculate",
    );
  }

  try {
    const result = await getMixRadiusSyncService().syncInvoices(
      startDate,
      endDate,
    );
    return apiSuccess({
      message: `Berhasil mensinkronisasi ${result.count} data.`,
      count: result.count,
    });
  } catch (error: unknown) {
    logger.error("[Manual Sync API] Error:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat sinkronisasi";
    return ApiErrors.internalError(errorMessage);
  }
});
