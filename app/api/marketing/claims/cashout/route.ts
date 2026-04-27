import { NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { createPointClaimService } from "@/modules/marketing";

const service = createPointClaimService();

/** Cash out accumulated approved point claims for the authenticated sales user. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    const result = await service.cashoutAccumulatedClaims(session.id);
    return apiSuccess(result, {
      status: 200,
      message: `Berhasil mencairkan ${result.cashedOutCount} poin canvasing.`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal mencairkan bonus canvasing";
    if (message === "User tidak ditemukan") return ApiErrors.notFound(message);
    if (message.includes("Hanya akun sales"))
      return ApiErrors.forbidden(message);
    if (message.includes("skema Target Bulanan"))
      return ApiErrors.badRequest(message);
    if (message.includes("Belum mencapai target"))
      return ApiErrors.badRequest(message);
    return ApiErrors.internalError(message);
  }
}
