import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getBankReconciliationService } from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["reconciliation:read"] },
  async (_request, ctx) => {
    const result = await getBankReconciliationService().findById(ctx.params.id);
    if (!result) return ApiErrors.notFound("Reconciliation tidak ditemukan");
    return apiSuccess(result);
  },
);
