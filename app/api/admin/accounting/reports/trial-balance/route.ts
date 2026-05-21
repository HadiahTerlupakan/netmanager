import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import { getTrialBalanceService } from "@/modules/accounting";
import { z } from "zod";

const querySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  asOfDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const GET = createHandler(
  { auth: true, permissions: ["accounting:read"] },
  async (_request, ctx) => {
    const parsed = querySchema.safeParse(ctx.query);
    if (!parsed.success) {
      return ApiErrors.badRequest("Parameter tanggal tidak valid (YYYY-MM-DD)");
    }

    const tenantId = ctx.session!.user.tenantId;
    const to = parsed.data.to || parsed.data.asOfDate;
    if (!to) {
      return ApiErrors.badRequest("Parameter 'to' atau 'asOfDate' wajib diisi");
    }

    const report = await getTrialBalanceService().generate(
      tenantId,
      to,
      parsed.data.from,
    );
    return apiSuccess(report);
  },
);
