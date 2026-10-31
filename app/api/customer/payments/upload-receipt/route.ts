import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api-response";
import { uploadCustomerPaymentReceipt } from "@/modules/pelanggan";
import { limitCustomerPaymentRequest } from "../../rate-limit";

/**
 * POST - Unggah (atau ganti) bukti transfer manual. Bukti dilampirkan ke
 * setiap invoice checkout-nya; jenis gambar diperiksa dari isi berkas, jadi
 * MIME kiriman klien tidak menentukan apa pun.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) return authResult.response;

    const session = authResult.session;
    const limited = limitCustomerPaymentRequest("uploadReceipt", session.id);
    if (limited) return limited;

    const formData = await request.formData();
    const invoiceId = formData.get("invoiceId");
    const file = formData.get("file");

    if (typeof invoiceId !== "string" || !invoiceId) {
      return apiError(
        "Parameter invoiceId wajib diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (!(file instanceof File)) {
      return apiError(
        "Tidak ada file gambar yang valid",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    try {
      const { tenantId } = await getTenantIdFromContext();
      const result = await uploadCustomerPaymentReceipt({
        invoiceId,
        file,
        customerId: session.id,
        customerCode: session.idPelanggan,
        tenantId,
      });

      if (result.status === "invalid-file") {
        return apiError(result.message, ErrorCodes.VALIDATION_ERROR, {
          status: 400,
        });
      }

      if (result.status === "not-found") {
        return apiError(
          "Pembayaran transfer manual yang pending tidak ditemukan",
          ErrorCodes.NOT_FOUND,
          { status: 404 },
        );
      }

      return apiSuccess(
        {
          receiptUrl: result.receiptUrl,
        },
        { message: "Bukti pembayaran berhasil diunggah" },
      );
    } catch (uploadError) {
      logger.error("Failed to upload image:", uploadError);
      return ApiErrors.internalError("Gagal menyimpan file bukti pembayaran");
    }
  } catch (error) {
    logger.error("Error in upload-receipt:", error);
    return ApiErrors.internalError("Terjadi kesalahan pada server");
  }
}
