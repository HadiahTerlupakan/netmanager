import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { AdminSalesRouteService } from "@/modules/marketing";
import { checkSiteRestriction } from "@/modules/roles";

const adminSalesRouteService = new AdminSalesRouteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("sales:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data sales",
    );
  }

  const { isRestricted, siteIds } = checkSiteRestriction(
    { user: ctx.session.user } as never,
    "sales",
  );
  const allowedSiteIds = isRestricted ? siteIds : undefined;

  try {
    return apiSuccess(
      await adminSalesRouteService.getSalesOverview({ allowedSiteIds }),
    );
  } catch (error) {
    logger.error("Error fetching sales data:", error);
    return ApiErrors.internalError(
      "Gagal mengambil data sales: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
});
