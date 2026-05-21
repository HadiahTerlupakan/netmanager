import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getInvestorDepositService } from "@/modules/investor";

/** GET: Mengambil daftar deposit PENDING untuk approval queue admin. */
export const GET = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (_req, ctx) => {
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) return ApiErrors.badRequest("Tenant ID tidak ditemukan");

    const service = getInvestorDepositService();
    const deposits = await service.listPending(tenantId);
    return apiSuccess(deposits);
  },
);
