import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  BankReconciliationService,
  ReconciliationRepository,
} from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:reconciliation"] },
  async (_request, ctx) => {
    const service = new BankReconciliationService(
      new ReconciliationRepository(),
    );
    const result = await service.findById(ctx.params.id);
    if (!result) return ApiErrors.notFound("Reconciliation tidak ditemukan");
    return apiSuccess(result);
  },
);
