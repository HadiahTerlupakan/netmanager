import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  BankReconciliationService,
  ReconciliationRepository,
  AccountingError,
} from "@/modules/accounting";

export const POST = createHandler(
  { auth: true, permissions: ["accounting:reconciliation"] },
  async (_request, ctx) => {
    try {
      const service = new BankReconciliationService(
        new ReconciliationRepository(),
      );
      const result = await service.complete(
        ctx.params.id,
        ctx.session!.user.id,
      );
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof AccountingError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
