import { logger } from "@/lib/logger";
import { z } from "zod";
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

const customerPaymentSchema = z.object({
  invoiceIds: z
    .array(
      z.string().includes("-", { message: "Invoice ID harus berformat UUID" }),
    )
    .min(1, "Pilih minimal satu tagihan untuk dibayar"),
  paymentMethod: z.string().min(1, "Metode pembayaran wajib diisi").optional(),
  couponCode: z.string().optional(),
  notes: z.string().max(500, "Catatan maksimal 500 karakter").optional(),
});

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
    logger.error("[Customer Payments GET Error]:", err);
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
    const parsed = customerPaymentSchema.safeParse(json);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Input tidak valid";
      return apiError(firstError, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    const { invoiceIds, couponCode, paymentMethod, notes } = parsed.data;
    const { tenantId } = await getTenantIdFromContext();

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
    logger.error("[Payment Create Error]:", err);

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
