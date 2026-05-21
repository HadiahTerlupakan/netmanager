import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorDepositService } from "@/modules/investor";

/** POST: Selesaikan deposit (VERIFIED → COMPLETED), trigger jurnal akuntansi. */
export const POST = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (_req, ctx) => {
    const { depositId } = ctx.params;

    try {
      const service = getInvestorDepositService();
      const deposit = await service.completeDeposit(depositId);
      return apiSuccess(deposit);
    } catch (error) {
      if (error instanceof Error) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
