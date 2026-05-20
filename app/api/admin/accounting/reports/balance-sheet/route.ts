import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getBalanceSheetService, asOfDateSchema } from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:read"] },
  async (_request, ctx) => {
    const parsed = asOfDateSchema.safeParse(ctx.query);
    if (!parsed.success) {
      return ApiErrors.badRequest(
        "Parameter asOfDate tidak valid (YYYY-MM-DD)",
      );
    }

    const tenantId = ctx.session!.user.tenantId;
    const report = await getBalanceSheetService().generate(
      tenantId,
      parsed.data.asOfDate,
    );
    return apiSuccess(report);
  },
);
