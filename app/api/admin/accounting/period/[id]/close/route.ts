import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getPeriodCloseService, AccountingError } from "@/modules/accounting";

export const POST = createHandler(
  { auth: true, permissions: ["accounting:period:close"] },
  async (_request, ctx) => {
    try {
      const result = await getPeriodCloseService().close(
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
