import { logger } from "@/lib/logger";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  AdminSalesRouteService,
  resolveSalesAllowedSiteIds,
  SALES_SITE_SCOPE_RESOURCE,
} from "@/modules/marketing";

const adminSalesRouteService = new AdminSalesRouteService();

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("sales:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data sales",
    );
  }

  // Dibatasi hanya bila role memegang `sales:site_only` (persis); site
  // diambil dari `siteIds` dengan fallback `siteId` legacy.
  const allowedSiteIds = resolveSalesAllowedSiteIds({
    user: ctx.session.user,
    permissions: ctx.permissions,
    resource: SALES_SITE_SCOPE_RESOURCE.overview,
  });

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
