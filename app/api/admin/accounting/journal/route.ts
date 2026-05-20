import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getJournalPostingService,
  getJournalRepository,
  createManualJournalSchema,
  toJournalResponseDto,
  AccountingError,
} from "@/modules/accounting";
import type { JournalSource, JournalStatus } from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:read"] },
  async (_request, ctx) => {
    const tenantId = ctx.session!.user.tenantId;
    const page = Number(ctx.query?.page || 1);
    const limit = Number(ctx.query?.limit || 50);

    const { items, total } = await getJournalRepository().list({
      tenantId,
      from: ctx.query?.from ? new Date(ctx.query.from as string) : undefined,
      to: ctx.query?.to ? new Date(ctx.query.to as string) : undefined,
      source: (ctx.query?.source as JournalSource) || undefined,
      status: (ctx.query?.status as JournalStatus) || undefined,
      skip: (page - 1) * limit,
      take: limit,
    });
    return apiSuccess({
      items: items.map(toJournalResponseDto),
      total,
      page,
      limit,
    });
  },
);

export const POST = createHandler(
  { auth: true, permissions: ["accounting:journal:create"] },
  async (request, ctx) => {
    const body = await request.json();
    const parsed = createManualJournalSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Input jurnal tidak valid");
    }

    try {
      const tenantId = ctx.session!.user.tenantId;
      const result = await getJournalPostingService().postManual(
        tenantId,
        parsed.data,
        ctx.session!.user.id,
      );
      return apiSuccess(toJournalResponseDto(result), { status: 201 });
    } catch (error) {
      if (error instanceof AccountingError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
