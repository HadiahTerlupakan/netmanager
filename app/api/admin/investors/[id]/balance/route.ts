import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorBalanceService } from "@/modules/investor";

/** GET: Mengambil ringkasan saldo investor. */
export const GET = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (_req, ctx) => {
    const { id } = ctx.params;

    try {
      const service = getInvestorBalanceService();
      const balance = await service.getBalance(id);
      return apiSuccess(balance);
    } catch (error) {
      if (error instanceof Error) {
        return ApiErrors.notFound(error.message);
      }
      throw error;
    }
  },
);
