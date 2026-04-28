import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { CustomerUsageService } from "@/modules/pelanggan";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

const usageService = new CustomerUsageService();

/**
 * GET - Get customer connection status and usage data
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const usageData = await usageService.getUsageData(authResult.session.id);

    return apiSuccess(usageData);
  } catch (error: unknown) {
    logger.error("[Customer Usage Error]:", error);

    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server";

    if (message === "Data pelanggan tidak ditemukan") {
      return ApiErrors.notFound("Pelanggan");
    }

    return ApiErrors.internalError(message);
  }
}
