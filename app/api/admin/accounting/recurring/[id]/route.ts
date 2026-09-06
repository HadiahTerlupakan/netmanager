import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getRecurringService,
  updateRecurringSchema,
  AccountingError,
} from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["recurring:manage"] },
  async (_request, ctx) => {
    const result = await getRecurringService().findById(ctx.params.id);
    if (!result) return ApiErrors.notFound("Template");
    return apiSuccess(result);
  },
);

export const PUT = createHandler(
  { auth: true, permissions: ["recurring:manage"] },
  async (request, ctx) => {
    const body = await request.json();
    const parsed = updateRecurringSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Input update tidak valid");
    }

    try {
      const result = await getRecurringService().update(
        ctx.params.id,
        parsed.data,
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

export const DELETE = createHandler(
  { auth: true, permissions: ["recurring:manage"] },
  async (_request, ctx) => {
    try {
      await getRecurringService().delete(ctx.params.id);
      return apiSuccess({ deleted: true });
    } catch (error) {
      if (error instanceof AccountingError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
