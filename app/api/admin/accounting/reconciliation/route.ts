import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  BankReconciliationService,
  ReconciliationRepository,
  createReconciliationSchema,
} from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:reconciliation"] },
  async (_request, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const coaId = ctx.query?.coaId as string | undefined;
    const service = new BankReconciliationService(
      new ReconciliationRepository(),
    );
    const items = await service.list(tenantId, coaId);
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
    const service = new BankReconciliationService(
      new ReconciliationRepository(),
    );
    const result = await service.create(tenantId, parsed.data);
    return apiSuccess(result, { status: 201 });
  },
);
