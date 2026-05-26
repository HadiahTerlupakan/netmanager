import { NextRequest } from "next/server";
import { RegistrationService } from "@/modules/registration";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/**
 * GET /api/public/registration-status/[id]
 * Lookup status pendaftaran. Untuk privacy, customer perlu kirim
 * `phone` di query string yang harus match dengan registrasi.
 *
 * Response: status, packageName, createdAt, updatedAt, rejectionReason
 *  (tidak expose alamat lengkap, IP, internal notes).
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const phone = request.nextUrl.searchParams.get("phone")?.trim();

    if (!id || !phone) {
      return ApiErrors.badRequest("ID pendaftaran dan nomor telepon wajib");
    }

    const service = new RegistrationService();
    const detail = await service.getById(id);

    if (!detail) {
      return ApiErrors.notFound("Pendaftaran");
    }

    // Verifikasi phone harus cocok untuk privacy.
    const registeredPhone = (detail.phone ?? "").replace(/\s|-/g, "");
    const inputPhone = phone.replace(/\s|-/g, "");
    if (registeredPhone !== inputPhone) {
      return ApiErrors.notFound("Pendaftaran");
    }

    return apiSuccess({
      id: detail.id,
      name: detail.name,
      packageName: detail.packageName,
      status: detail.status,
      rejectionReason: detail.rejectionReason,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
      verifiedAt: detail.verifiedAt,
    });
  } catch (error: unknown) {
    logger.error("[Public Registration Status] Error:", error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : "Gagal mengambil status",
    );
  }
}
