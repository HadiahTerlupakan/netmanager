import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getChartOfAccountService,
  AccountingError,
} from "@/modules/accounting";
import { z } from "zod";

const createCoaSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
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
  normalSide: z.enum(["DEBIT", "CREDIT"]).optional(),
  cashFlowCategory: z
    .enum(["OPERATING", "INVESTING", "FINANCING"])
    .nullable()
    .optional(),
  parentId: z.string().nullable().optional(),
  isPostable: z.boolean().optional(),
  description: z.string().nullable().optional(),
});

export const GET = createHandler(
  { auth: true, permissions: ["accounting:read"] },
  async (_request, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const type = ctx.query?.type as string | undefined;
    const isActive = ctx.query?.isActive;

    const service = getChartOfAccountService();
    const items = await service.list(tenantId, {
      type: type as
        | "ASSET"
        | "LIABILITY"
        | "EQUITY"
        | "REVENUE"
        | "EXPENSE"
        | undefined,
      isActive:
        isActive === "true" ? true : isActive === "false" ? false : undefined,
    });
    return apiSuccess(items);
  },
);

export const POST = createHandler(
  { auth: true, permissions: ["coa:manage"] },
  async (request, ctx) => {
    const body = await request.json();
    const parsed = createCoaSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Input COA tidak valid");
    }

    try {
      const tenantId = ctx.session!.user.tenantId;
      const service = getChartOfAccountService();
      const result = await service.create(tenantId, parsed.data);
      return apiSuccess(result, { status: 201 });
    } catch (error) {
      if (error instanceof AccountingError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
