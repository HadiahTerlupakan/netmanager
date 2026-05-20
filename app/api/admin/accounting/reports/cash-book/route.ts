import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getCashBookService, ledgerQuerySchema } from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:read"] },
  async (_request, ctx) => {
    const parsed = ledgerQuerySchema.safeParse(ctx.query);
    if (!parsed.success) {
      return ApiErrors.badRequest("Parameter coaId/from/to tidak valid");
    }

    const tenantId = ctx.session!.user.tenantId;
    const report = await getCashBookService().generate(
      tenantId,
      parsed.data.coaId,
      parsed.data.from,
      parsed.data.to,
    );
    return apiSuccess(report);
  },
);
