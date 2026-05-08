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

  // Site restriction only applies if user has sales:site_only permission
  const user = ctx.session.user as {
    id: string;
    siteIds?: string[];
    isSuperAdmin?: boolean;
  };
  const allowedSiteIds =
    !isSuperAdmin(user) && (await hasPermission("sales:site_only"))
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
