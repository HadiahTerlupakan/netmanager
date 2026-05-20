import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getBankReconciliationService,
  AccountingError,
} from "@/modules/accounting";

export const POST = createHandler(
  { auth: true, permissions: ["reconciliation:manage"] },
  async (_request, ctx) => {
    try {
      const result = await getBankReconciliationService().complete(
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
