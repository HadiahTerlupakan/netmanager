import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { InvestorPayoutAdminService } from "@/modules/investor";

const investorPayoutAdminService = new InvestorPayoutAdminService();

export const GET = createHandler(
  {
    auth: true,
    permissions: ["investors:read"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const investor = await investorPayoutAdminService.getInvestorDetail(id);
    if (!investor) {
      return ApiErrors.notFound("Investor");
    }
    return apiSuccess(investor);
  },
);
