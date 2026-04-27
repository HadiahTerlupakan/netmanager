import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { CustomerPaymentMethodService } from "@/modules/finance";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const service = new CustomerPaymentMethodService();

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) return authResult.response;

    return apiSuccess(await service.getCustomerPaymentMethods());
  } catch (error) {
    logger.error(
      "[Payment Methods Error]",
      error instanceof Error ? error : undefined,
    );
    return ApiErrors.internalError("Gagal memuat metode pembayaran");
  }
}
