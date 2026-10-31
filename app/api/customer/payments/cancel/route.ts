import { z } from "zod";
import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { isRouteServiceError } from "@/lib/api/route-service-error";
import { requireCustomerAuth } from "@/lib/customer-auth";
import {
  apiError,
  apiSuccess,
  ApiErrors,
  ErrorCodes,
} from "@/lib/api-response";
import { cancelCustomerManualCheckout } from "@/modules/pelanggan";
import { limitCustomerPaymentRequest } from "../../rate-limit";

const cancelPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Parameter invoiceId wajib diisi"),
});

/**
 * POST - Batalkan transfer manual menunggu yang memuat tagihan ini, selama
 * admin belum memverifikasinya. Checkout gateway tidak dibatalkan di sini.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) return authResult.response;

    const limited = limitCustomerPaymentRequest(
      "cancelPayment",
      authResult.session.id,
    );
    if (limited) return limited;

    const parsed = cancelPaymentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError(
        parsed.error.issues[0]?.message ?? "Input tidak valid",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    await cancelCustomerManualCheckout({
      customerId: authResult.session.id,
      invoiceId: parsed.data.invoiceId,
    });
    return apiSuccess(null, { message: "Transfer manual dibatalkan" });
  } catch (error) {
    if (isRouteServiceError(error)) {
      return apiError(error.message, ErrorCodes.CONFLICT, {
        status: error.status,
      });
    }
    logger.error("[Customer Payment Cancel Error]:", error);
    return ApiErrors.internalError("Gagal membatalkan transfer manual");
  }
}
