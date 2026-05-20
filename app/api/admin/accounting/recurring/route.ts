import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getRecurringService,
  createRecurringSchema,
} from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:recurring:manage"] },
  async (_request, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const items = await getRecurringService().list(tenantId);
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
    const result = await getRecurringService().create(tenantId, parsed.data);
    return apiSuccess(result, { status: 201 });
  },
);
