import { ApiErrors, apiSuccess, createHandler } from "@/lib/api";
import { createRadiusDashboardService } from "@/modules/network";

const radiusDashboardService = createRadiusDashboardService();

export const GET = createHandler(
  { auth: true, permissions: ["radius:read"] },
  async (_req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) {
      return ApiErrors.forbidden("Tenant tidak valid");
    }

    const stats = await radiusDashboardService.getStats({ tenantId });
    return apiSuccess(stats);
  },
);
