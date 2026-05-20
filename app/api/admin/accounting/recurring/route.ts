import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  RecurringService,
  RecurringRepository,
  createRecurringSchema,
} from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:recurring:manage"] },
  async (_request, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const service = new RecurringService(new RecurringRepository());
    const items = await service.list(tenantId);
    return apiSuccess(items);
  },
);

export const POST = createHandler(
  { auth: true, permissions: ["accounting:recurring:manage"] },
  async (request, ctx) => {
    const body = await request.json();
    const parsed = createRecurringSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Input template tidak valid");
    }

    const tenantId = ctx.session!.user.tenantId;
    const service = new RecurringService(new RecurringRepository());
    const result = await service.create(tenantId, parsed.data);
    return apiSuccess(result, { status: 201 });
  },
);
