import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { requireCustomerAuth } from "@/lib/customer-auth";
import {
  apiSuccess,
  ApiErrors,
  ErrorCodes,
  apiError,
} from "@/lib/api-response";
import { uploadCustomerPaymentReceipt } from "@/modules/pelanggan";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireCustomerAuth(request);
    if (authResult.response) return authResult.response;

    const session = authResult.session!;
    if (!session) return ApiErrors.unauthorized("Sesi tidak valid");

    const formData = await request.formData();
    const invoiceId = formData.get("invoiceId") as string;
    const file = formData.get("file") as File | null;

    if (!invoiceId) {
      return apiError(
        "Parameter invoiceId wajib diisi",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (!file || !(file instanceof File)) {
      return apiError(
        "Tidak ada file gambar yang valid",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    if (!file.type.startsWith("image/")) {
      return apiError("File harus berupa gambar", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    try {
      const result = await uploadCustomerPaymentReceipt({
        invoiceId,
        file,
        customerId: session.id,
        customerCode: session.idPelanggan,
      });

      if (result.status === "not-found") {
        return apiError(
          "Pembayaran transfer manual yang pending tidak ditemukan",
          ErrorCodes.NOT_FOUND,
          { status: 404 },
        );
      }

      await notifyAdminsAboutReceiptUpload();

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

async function notifyAdminsAboutReceiptUpload() {
  try {
    const { getAdminTokens, sendFCMNotification } =
      await import("@/lib/firebase/messaging");
    const tokens = await getAdminTokens();
    await sendFCMNotification(
      tokens,
      "Persetujuan Pembayaran",
      "Struk pembayaran baru diunggah pelanggan",
      { url: "/admin/payments/approval" },
    );
  } catch (error) {
    logger.error("[FCM] Push failed", error);
  }
}
