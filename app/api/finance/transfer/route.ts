import { logger } from "@/lib/logger";
import {
  FinanceService,
  FinancialAccountNotFoundError,
  InsufficientBalanceError,
} from "@/modules/finance";
import * as z from "zod";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import { TREASURY_TRANSFER_PERMISSIONS } from "@/lib/financial-write-permissions";

const transferSchema = z.object({
  sourceAccountId: z.string().min(1, "Akun asal wajib diisi"),
  destinationAccountId: z.string().min(1, "Akun tujuan wajib diisi"),
  amount: z.number().min(1, "Nominal harus lebih dari 0"),
  date: z.string().or(z.date()),
  description: z.string().optional(),
});

export const POST = createHandler(
  {
    auth: true,
    permissions: TREASURY_TRANSFER_PERMISSIONS,
    schema: transferSchema,
  },
  async (req, ctx) => {
    const { sourceAccountId, destinationAccountId, amount, date, description } =
      ctx.validated;

    if (sourceAccountId === destinationAccountId) {
      return ApiErrors.badRequest("Akun asal dan tujuan tidak boleh sama");
    }

    const financeService = new FinanceService();

    try {
      await financeService.transferFunds({
        sourceAccountId,
        destinationAccountId,
        amount,
        date,
        createdById: ctx.session!.user.id,
        ...(description ? { description } : {}),
      });

      return apiSuccess(null, { message: "Transfer berhasil" });
    } catch (error: unknown) {
      // Dicocokkan lewat tipe, bukan teks pesan: sebelumnya penanganan ini
      // mencari kata "insufficient"/"saldo tidak cukup" pada pesan error,
      // padahal repository tidak pernah memeriksa saldo sehingga cabang itu
      // tidak pernah tercapai dan transfer bisa membuat saldo minus.
      if (error instanceof InsufficientBalanceError) {
        return ApiErrors.badRequest(error.message);
      }
      if (error instanceof FinancialAccountNotFoundError) {
        return ApiErrors.notFound("Akun keuangan");
      }
      logger.error("Transfer Error:", error);
      throw error; // Let createHandler handle unknown errors
    }
  },
);
