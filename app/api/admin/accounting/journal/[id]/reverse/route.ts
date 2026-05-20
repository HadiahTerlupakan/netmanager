import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getJournalReverseService,
  reverseJournalSchema,
  toJournalResponseDto,
  AccountingError,
} from "@/modules/accounting";

export const POST = createHandler(
  { auth: true, permissions: ["journal:update"] },
  async (request, ctx) => {
    const journalId = ctx.params.id;
    const body = await request.json();
    const parsed = reverseJournalSchema.safeParse({ ...body, journalId });
    if (!parsed.success) {
      return ApiErrors.badRequest("Alasan reversal wajib diisi");
    }

    try {
      const result = await getJournalReverseService().reverse(
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
