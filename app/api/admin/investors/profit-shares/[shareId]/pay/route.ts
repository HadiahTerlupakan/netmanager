import { z } from "zod";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorProfitShareService } from "@/modules/investor";

const paySchema = z.object({
  payoutId: z.string().optional(),
});

/** POST: Tandai profit share sebagai dibayar (APPROVED → PAID). */
export const POST = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (req, ctx) => {
    const { shareId } = ctx.params;
    const userId = ctx.session?.user.id;
    if (!userId) return ApiErrors.unauthorized();

    const body = await req.json().catch(() => ({}));
    const data = paySchema.parse(body);

    try {
      const service = getInvestorProfitShareService();
      const share = await service.markPaid(shareId, userId, data.payoutId);
      return apiSuccess(share);
    } catch (error) {
      if (error instanceof Error) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
