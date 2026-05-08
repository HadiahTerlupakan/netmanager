import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { AdminSalesRouteService } from "@/modules/marketing";
import { isSuperAdmin } from "@/lib/auth";

const adminSalesRouteService = new AdminSalesRouteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("sales:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data sales",
    );
  }

  // Enforce site restriction for non-super-admin users
  const user = ctx.session.user as {
    id: string;
    siteIds?: string[];
    isSuperAdmin?: boolean;
  };
  const allowedSiteIds =
    !isSuperAdmin(user) && user.siteIds && user.siteIds.length > 0
      ? user.siteIds
      : undefined;

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
