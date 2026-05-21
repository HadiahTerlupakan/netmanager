import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorDepositService } from "@/modules/investor";

/** POST: Verifikasi deposit (PENDING → VERIFIED). */
export const POST = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (_req, ctx) => {
    const { depositId } = ctx.params;
    const userId = ctx.session?.user.id;
    if (!userId) return ApiErrors.unauthorized();

    try {
      const service = getInvestorDepositService();
      const deposit = await service.verifyDeposit(depositId, userId);
      return apiSuccess(deposit);
    } catch (error) {
      if (error instanceof Error) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
