import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getCashFlowService, dateRangeSchema } from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:read"] },
  async (_request, ctx) => {
    const parsed = dateRangeSchema.safeParse(ctx.query);
    if (!parsed.success) {
      return ApiErrors.badRequest("Parameter from/to tidak valid (YYYY-MM-DD)");
    }

    const tenantId = ctx.session!.user.tenantId;
    const report = await getCashFlowService().generate(
      tenantId,
      parsed.data.from,
      parsed.data.to,
    );
    return apiSuccess(report);
  },
);
