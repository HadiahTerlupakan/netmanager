import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getBankReconciliationService,
  manualMatchSchema,
} from "@/modules/accounting";

export const POST = createHandler(
  { auth: true, permissions: ["accounting:reconciliation"] },
  async (request, _ctx) => {
    const body = await request.json();
    const parsed = manualMatchSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("lineId dan journalLineId wajib diisi");
    }

    await getBankReconciliationService().manualMatch(
      parsed.data.lineId,
      parsed.data.journalLineId,
    );
    return apiSuccess({ matched: true });
  },
);
