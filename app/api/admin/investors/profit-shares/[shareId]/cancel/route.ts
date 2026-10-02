import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { isRouteServiceError } from "@/lib/api/route-service-error";
import { getInvestorProfitShareService } from "@/modules/investor";

const HTTP_NOT_FOUND = 404;

/**
 * POST: Batalkan bagi hasil yang belum dibayar (CALCULATED/APPROVED →
 * CANCELLED). Bulan-bulan proyeknya terbuka lagi untuk dikoreksi & dihitung ulang.
 */
export const POST = createHandler(
  { auth: true, permissions: ["investors:manage"] },
  async (_req, ctx) => {
    const { shareId } = ctx.params;
    const tenantId = ctx.session?.user.tenantId;
    if (!tenantId) return ApiErrors.badRequest("Tenant ID tidak ditemukan");
    try {
      const share = await getInvestorProfitShareService().cancel(shareId, tenantId);
      return apiSuccess(share);
    } catch (error) {
      // Hanya galat domain yang pesannya aman untuk klien; sisanya ke handler pusat.
      if (!isRouteServiceError(error)) throw error;
      return error.status === HTTP_NOT_FOUND
        ? ApiErrors.notFound("Bagi hasil")
        : ApiErrors.badRequest(error.message);
    }
  },
);
