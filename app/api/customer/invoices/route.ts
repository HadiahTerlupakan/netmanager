import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { CustomerPortalService } from "@/modules/pelanggan";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

const customerPortalService = new CustomerPortalService();

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsedValue = Number.parseInt(value ?? "", 10);
  return Number.isNaN(parsedValue) || parsedValue <= 0 ? fallback : parsedValue;
}

/**
 * GET - Get customer invoices
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), DEFAULT_PAGE);
    const limit = parsePositiveInteger(
      searchParams.get("limit"),
      DEFAULT_LIMIT,
    );
    const statusParam = searchParams.get("status") || undefined;
    const status = statusParam ? statusParam.split(",") : undefined;

    const result = await customerPortalService.getInvoices(
      authResult.session.id,
      page,
      limit,
      status,
    );

    return apiSuccess(result);
  } catch (error) {
    logger.error("[Customer Invoices Error]:", error);

    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    if (message === "Data pelanggan tidak ditemukan") {
      return ApiErrors.notFound("Pelanggan");
    }

    return ApiErrors.internalError(message);
  }
}
