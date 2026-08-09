import { createHandler, apiSuccess } from "@/lib/api";
import { planningDashboardService } from "@/modules/planning";

/**
 * GET /api/planning/dashboard
 * Get dashboard metrics untuk planning dengan aggregated statistics
 */
export const GET = createHandler(
  {
    auth: true,
    permissions: ["planning.read"],
  },
  async (req, ctx) => {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const filters = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const dashboard = await planningDashboardService.getDashboard(
      ctx.session.user.tenantId,
      filters,
    );

    return apiSuccess(dashboard);
  },
);
