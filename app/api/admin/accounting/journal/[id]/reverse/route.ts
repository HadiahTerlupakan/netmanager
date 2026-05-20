import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  JournalReverseService,
  JournalRepository,
  ChartOfAccountRepository,
  PeriodRepository,
  reverseJournalSchema,
  toJournalResponseDto,
  AccountingError,
} from "@/modules/accounting";

export const POST = createHandler(
  { auth: true, permissions: ["accounting:journal:reverse"] },
  async (request, ctx) => {
    const journalId = ctx.params.id;
    const body = await request.json();
    const parsed = reverseJournalSchema.safeParse({ ...body, journalId });
    if (!parsed.success) {
      return ApiErrors.badRequest("Alasan reversal wajib diisi");
    }

    try {
      const service = new JournalReverseService(
        new JournalRepository(),
        new ChartOfAccountRepository(),
        new PeriodRepository(),
      );
      const result = await service.reverse(
        journalId,
        parsed.data.reason,
        ctx.session!.user.id,
      );
      return apiSuccess(toJournalResponseDto(result));
    } catch (error) {
      if (error instanceof AccountingError) {
        return ApiErrors.badRequest(error.message);
      }
      throw error;
    }
  },
);
