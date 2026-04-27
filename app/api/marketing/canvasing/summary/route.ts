import { NextRequest } from "next/server";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { createCanvasingService } from "@/modules/marketing";

const canvasingService = createCanvasingService();

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    const permissions = await getUserPermissions(session.id);
    const canReadAll =
      isSuperAdminRole(session.role) || permissions.includes("canvasing:read");
    const summary = await canvasingService.getCompletionSummary({
      canReadAll,
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
