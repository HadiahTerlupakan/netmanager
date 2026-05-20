import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getBankReconciliationService,
  createReconciliationSchema,
} from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:reconciliation"] },
  async (_request, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const coaId = ctx.query?.coaId as string | undefined;
    const items = await getBankReconciliationService().list(tenantId, coaId);
    return apiSuccess(items);
  },
);

export const POST = createHandler(
  { auth: true, permissions: ["accounting:reconciliation"] },
  async (request, ctx) => {
    const body = await request.json();
    const parsed = createReconciliationSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Input reconciliation tidak valid");
    }

    const tenantId = ctx.session!.user.tenantId;
    const result = await getBankReconciliationService().create(
      tenantId,
      parsed.data,
    );
    return apiSuccess(result, { status: 201 });
  },
);
