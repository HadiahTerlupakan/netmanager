import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorProfitShareService } from "@/modules/investor";

/** POST: Approve profit share (CALCULATED → APPROVED). */
export const POST = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (_req, ctx) => {
    const { shareId } = ctx.params;
    const userId = ctx.session?.user.id;
    if (!userId) return ApiErrors.unauthorized();
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) return ApiErrors.badRequest("Tenant ID tidak ditemukan");

    try {
      const service = getInvestorProfitShareService();
      const share = await service.approve(shareId, tenantId, userId);
      return apiSuccess(share);
    } catch (error) {
      if (error instanceof Error) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
