import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { requireCustomerAuth } from "@/lib/customer-auth";
import {
  apiError,
  apiSuccess,
  ApiErrors,
  ErrorCodes,
} from "@/lib/api-response";
import {
  supportTicketUploadService,
  type SupportTicketUploadResult,
} from "@/modules/pelanggan";

type UploadFailure = Extract<SupportTicketUploadResult, { ok: false }>;

// tsconfig tanpa strictNullChecks tidak mempersempit union lewat `ok`.
function isUploadFailure(
  result: SupportTicketUploadResult,
): result is UploadFailure {
  return !result.ok;
}

/**
 * POST /api/customer/tickets/attachments
 * Unggah gambar lampiran tiket dari portal pelanggan.
 *
 * Rute terpisah dari /api/uploads (khusus sesi staf NextAuth) supaya
 * /api/uploads tidak perlu dibuka untuk token pelanggan. Validasi tipe,
 * ukuran, dan lokasi simpan sama persis karena memakai service yang sama.
 */
export async function POST(request: NextRequest) {
  const auth = await requireCustomerAuth(request);
  if (auth.response) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const result = await supportTicketUploadService.upload(
      file instanceof File ? file : null,
    );

    if (isUploadFailure(result)) {
      return apiError(result.message, ErrorCodes.VALIDATION_ERROR, {
        status: result.status,
      });
    }
    return apiSuccess(result.data);
  } catch (error) {
    logger.error("[Customer Ticket Attachment] Upload error:", error);
    return ApiErrors.internalError("Gagal mengunggah lampiran");
  }
}
