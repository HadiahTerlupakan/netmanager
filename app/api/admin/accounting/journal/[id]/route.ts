import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getJournalRepository,
  toJournalResponseDto,
} from "@/modules/accounting";

export const GET = createHandler(
  { auth: true, permissions: ["accounting:read"] },
  async (_request, ctx) => {
    const result = await getJournalRepository().findById(ctx.params.id);
    if (!result) return ApiErrors.notFound("Journal tidak ditemukan");
    return apiSuccess(toJournalResponseDto(result));
  },
);
