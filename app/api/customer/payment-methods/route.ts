import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { CustomerPaymentMethodService } from "@/modules/finance";
import { logger } from "@/lib/logger";
import { getTenantIdFromContext } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

const service = new CustomerPaymentMethodService();

/** Nominal rupiah dari query; nilai yang tidak sah diabaikan. */
function parseAmount(value: string | null) {
  const amount = Number(value);
  return value && Number.isSafeInteger(amount) && amount > 0
    ? amount
    : undefined;
}

/**
 * GET - Metode pembayaran untuk pelanggan. `?amount=` (opsional): total yang
 * akan dibayar, agar kanal gateway yang tidak aktif untuk nominal itu tidak
 * ditawarkan.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) return authResult.response;

    const { tenantId } = await getTenantIdFromContext();
    if (!tenantId) {
      return ApiErrors.badRequest("Tenant ID tidak ditemukan");
    }

    const amount = parseAmount(request.nextUrl.searchParams.get("amount"));
    return apiSuccess(
      await service.getCustomerPaymentMethods(tenantId, amount),
    );
  } catch (error) {
    logger.error(
      "[Payment Methods Error]",
      error instanceof Error ? error : undefined,
    );
    return ApiErrors.internalError("Gagal memuat metode pembayaran");
  }
}
