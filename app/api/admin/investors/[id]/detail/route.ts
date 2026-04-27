import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { ManualPaymentAdminRouteService } from "@/modules/finance";

const manualPaymentAdminRouteService = new ManualPaymentAdminRouteService();

export const GET = createHandler(
  {
    auth: true,
    permissions: ["investors:read"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const investor = await manualPaymentAdminRouteService.getInvestorDetail(id);
    if (!investor) {
      return ApiErrors.notFound("Investor");
    }
    return apiSuccess(investor);
  },
);
