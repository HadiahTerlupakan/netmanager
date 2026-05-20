import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getOpeningBalanceService,
  openingBalanceSchema,
  toJournalResponseDto,
  AccountingError,
} from "@/modules/accounting";

export const POST = createHandler(
  { auth: true, permissions: ["journal:create"] },
  async (request, ctx) => {
    const body = await request.json();
    const parsed = openingBalanceSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("Input opening balance tidak valid");
    }

    try {
      const result = await getOpeningBalanceService().post(
        ctx.session!.user.tenantId,
        parsed.data.entryDate,
        parsed.data.lines,
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
