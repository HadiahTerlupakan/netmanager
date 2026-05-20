import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  RecurringService,
  RecurringRepository,
  updateRecurringSchema,
  AccountingError,
} from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:recurring:manage"] },
  async (_request, ctx) => {
    const service = new RecurringService(new RecurringRepository());
    const result = await service.findById(ctx.params.id);
    if (!result) return ApiErrors.notFound("Template tidak ditemukan");
    return apiSuccess(result);
  },
);

export const PUT = createHandler(
  { auth: true, permissions: ["accounting:recurring:manage"] },
  async (request, ctx) => {
    const body = await request.json();
    const parsed = updateRecurringSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Input update tidak valid");
    }

    try {
      const service = new RecurringService(new RecurringRepository());
      const result = await service.update(ctx.params.id, parsed.data);
      return apiSuccess(result);
    } catch (error) {
      if (error instanceof AccountingError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);

export const DELETE = createHandler(
  { auth: true, permissions: ["accounting:recurring:manage"] },
  async (_request, ctx) => {
    try {
      const service = new RecurringService(new RecurringRepository());
      await service.delete(ctx.params.id);
      return apiSuccess({ deleted: true });
    } catch (error) {
      if (error instanceof AccountingError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
