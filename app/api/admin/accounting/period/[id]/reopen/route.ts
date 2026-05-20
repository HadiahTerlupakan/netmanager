import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  PeriodCloseService,
  PeriodRepository,
  JournalRepository,
  ChartOfAccountRepository,
  AccountingError,
} from "@/modules/accounting";

export const POST = createHandler(
  { auth: true, permissions: ["accounting:period:reopen"] },
  async (_request, ctx) => {
    const periodId = ctx.params.id;

    try {
      const service = new PeriodCloseService(
        new PeriodRepository(),
        new JournalRepository(),
        new ChartOfAccountRepository(),
      );
      const result = await service.reopen(periodId, ctx.session!.user.id);
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof AccountingError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
