import { apiSuccess, createHandler } from "@/lib/api";
import { getPeriodService } from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:read"] },
  async (_request, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const periods = await getPeriodService().list(tenantId);
    return apiSuccess(periods);
  },
);
