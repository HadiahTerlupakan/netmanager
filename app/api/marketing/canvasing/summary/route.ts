import { NextRequest } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { createCanvasingService } from "@/modules/marketing";

const canvasingService = createCanvasingService();

/**
 * Ringkasan canvasing personal untuk dashboard mobile ("Canvasing Saya").
 * Selalu scoped ke salesId = user yang login — bukan tenant-wide.
 * Permission canvasing:read (admin list) tidak memperluas scope di sini.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    const summary = await canvasingService.getCompletionSummary({
      canReadAll: false,
      userId: session.id,
    });

    return apiSuccess(summary);
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal mengambil ringkasan canvasing";
    return ApiErrors.internalError(message);
  }
}
