import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { AdminSalesRouteService } from "@/modules/marketing";

const adminSalesRouteService = new AdminSalesRouteService();

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
  if (!(await hasPermission("sales:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat data sales",
    );
  }
  try {
    return apiSuccess(await adminSalesRouteService.getSalesOverview());
  } catch (error) {
    console.error("Error fetching sales data:", error);
    return ApiErrors.internalError(
      "Gagal mengambil data sales: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
});
