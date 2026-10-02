import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorProfitShareService } from "@/modules/investor";

/**
 * POST: Batalkan bagi hasil yang belum dibayar (CALCULATED/APPROVED →
 * CANCELLED). Bulan-bulan proyeknya terbuka lagi untuk dikoreksi & dihitung ulang.
 */
export const POST = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (_req, ctx) => {
    const { shareId } = ctx.params;
    try {
      const share = await getInvestorProfitShareService().cancel(shareId);
      return apiSuccess(share);
    } catch (error) {
      if (error instanceof Error) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
