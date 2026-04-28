import { hasPermission } from "@/lib/rbac";
import { ApiErrors, createHandler } from "@/lib/api";
import { getAdminWorkOrderDashboardService } from "@/modules/work-order";

// GET /api/admin/workorders/analytics
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("work_order_dashboard:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat analitik work order",
    );
  }

  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") || "all_time";

  return getAdminWorkOrderDashboardService().getAnalyticsData({
    user,
    permissions: ctx.permissions,
    period,
  });
});
