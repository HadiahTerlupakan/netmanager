import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getChartOfAccountService,
  AccountingError,
} from "@/modules/accounting";
import { z } from "zod";

const updateCoaSchema = z.object({
  name: z.string().min(1).optional(),
  subtype: z
    .enum([
      "CURRENT_ASSET",
      "FIXED_ASSET",
      "CURRENT_LIABILITY",
      "LONG_TERM_LIABILITY",
      "CONTRIBUTED_CAPITAL",
      "RETAINED_EARNINGS",
      "OPERATING_REVENUE",
      "OTHER_REVENUE",
      "COGS",
      "OPEX",
      "OTHER_EXPENSE",
    ])
    .nullable()
    .optional(),
  cashFlowCategory: z
    .enum(["OPERATING", "INVESTING", "FINANCING"])
    .nullable()
    .optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

export const GET = createHandler(
  { auth: true, permissions: ["accounting:read"] },
  async (_request, ctx) => {
    const service = getChartOfAccountService();
    const result = await service.findById(ctx.params.id);
    if (!result) return ApiErrors.notFound("COA");
    return apiSuccess(result);
  },
);

export const PUT = createHandler(
  { auth: true, permissions: ["coa:manage"] },
  async (request, ctx) => {
    const body = await request.json();
    const parsed = updateCoaSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Input update tidak valid");
    }

    try {
      const service = getChartOfAccountService();
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
  { auth: true, permissions: ["coa:manage"] },
  async (_request, ctx) => {
    try {
      const service = getChartOfAccountService();
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
