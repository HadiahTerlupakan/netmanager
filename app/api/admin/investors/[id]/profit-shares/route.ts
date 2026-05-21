import { apiSuccess, createHandler } from "@/lib/api";
import { getInvestorProfitShareService } from "@/modules/investor";

/** GET: Mengambil daftar profit share untuk investor tertentu. */
export const GET = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (_req, ctx) => {
    const { id } = ctx.params;
    const service = getInvestorProfitShareService();
    const shares = await service.listByInvestor(id);
    return apiSuccess(shares);
  },
);
