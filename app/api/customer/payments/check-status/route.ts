import { z } from "zod";
import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { requireCustomerAuth } from "@/lib/customer-auth";
import {
  apiError,
  apiSuccess,
  ApiErrors,
  ErrorCodes,
} from "@/lib/api-response";
import { checkCustomerPaymentStatus } from "@/modules/pelanggan";
import { limitCustomerPaymentRequest } from "../../rate-limit";

const checkStatusSchema = z.object({
  invoiceId: z.string().min(1, "Parameter invoiceId wajib diisi"),
});

/**
 * POST - Tanyakan status pembayaran tagihan ke gateway, misalnya saat
 * pelanggan kembali dari halaman bayar. Pembayaran yang sudah masuk namun
 * callback-nya belum sampai langsung dilunasi.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) return authResult.response;

    const limited = limitCustomerPaymentRequest(
      "checkStatus",
      authResult.session.id,
    );
    if (limited) return limited;

    const parsed = checkStatusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Input tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const status = await checkCustomerPaymentStatus({
      customerId: authResult.session.id,
      invoiceId: parsed.data.invoiceId,
    });
    return apiSuccess({ status });
  } catch (error) {
    logger.error("[Customer Payment Check Status Error]:", error);
    return ApiErrors.internalError("Gagal memeriksa status pembayaran");
  }
}
