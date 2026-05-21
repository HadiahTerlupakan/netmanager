import { z } from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorDepositService } from "@/modules/investor";

const rejectSchema = z.object({
  reason: z.string().min(1, "Alasan penolakan wajib diisi"),
});

/** POST: Tolak deposit, body: { reason }. */
export const POST = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (req, ctx) => {
    const { depositId } = ctx.params;
    const body = await req.json();
    const { reason } = rejectSchema.parse(body);

    try {
      const service = getInvestorDepositService();
      const deposit = await service.rejectDeposit(depositId, reason);
      return apiSuccess(deposit);
    } catch (error) {
      if (error instanceof Error) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
