import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import { CustomerPortalService } from "@/modules/pelanggan";
import { createCustomerPaymentForRoute } from "@/modules/pelanggan";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api-response";

const customerPortalService = new CustomerPortalService();

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const result = await customerPortalService.getPaymentHistory(
      authResult.session.id,
      page,
      limit,
    );

    return apiSuccess(result);
  } catch (error) {
    const err = error as Error;
    console.error("[Customer Payments GET Error]:", err);
    return ApiErrors.internalError(err.message || "Terjadi kesalahan server");
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) {
      return authResult.response;
    }

    const json = await request.json();
    const { invoiceIds, couponCode, paymentMethod, notes } = json;
    const { tenantId } = await getTenantIdFromContext();

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return apiError(
        "Pilih minimal satu tagihan untuk dibayar",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    const result = await createCustomerPaymentForRoute({
      customerId: authResult.session.id,
      tenantId,
      invoiceIds,
      couponCode,
      paymentMethod,
      notes,
    });

    return apiSuccess(result, {
      message: result.paymentUrl
        ? "Menunggu pembayaran via gateway"
        : "Pembayaran berhasil diproses",
    });
  } catch (error) {
    const err = error as Error;
    console.error("[Payment Create Error]:", err);

    if (
      err.message === "Beberapa tagihan tidak valid atau sudah dibayar" ||
      err.message === "Kupon tidak valid"
    ) {
      return apiError(err.message, ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    return ApiErrors.internalError(err.message || "Gagal memproses pembayaran");
  }
}
