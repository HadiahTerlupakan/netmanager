import { hasPermission } from "@/lib/rbac";
import { ApiErrors, createHandler } from "@/lib/api";
import { adminWorkOrderDashboardService } from "@/modules/work-order";

// GET /api/admin/workorders/dashboard
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;

  if (!(await hasPermission("work_order_dashboard:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat dashboard work order",
    );
  }

  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") || "all_time";

  return adminWorkOrderDashboardService.getDashboardData({
    user,
    permissions: ctx.permissions,
    period,
  });
});
