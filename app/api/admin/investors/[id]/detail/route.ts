import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorPayoutAdminService } from "@/modules/investor";

export const GET = createHandler(
  {
    auth: true,
    permissions: ["investors:read"],
  },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const investor =
      await getInvestorPayoutAdminService().getInvestorDetail(id);
    if (!investor) {
      return ApiErrors.notFound("Investor");
    }
    return apiSuccess(investor);
  },
);
