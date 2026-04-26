import { NextRequest } from "next/server";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import { createCanvasingService } from "@/modules/marketing";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
} from "@/lib/api-response";
import { canAccessCanvasingSite } from "../../canvasingRouteAccess";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await verifyAuth(req);
    if (!session) return ApiErrors.unauthorized("Tidak terautentikasi");

    const isSuperAdmin = isSuperAdminRole(session.role);
    const permissions = await getUserPermissions(session.id);
    const canReviewCanvasing =
      permissions.includes("canvasing:update") ||
      permissions.includes("canvasing:verify");

    if (!isSuperAdmin && !canReviewCanvasing) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menolak canvasing",
      );
    }

    const service = createCanvasingService();
    const existingRequest = await service.getRequestByIdWithSales(id);
    if (!existingRequest) return ApiErrors.notFound("Data canvasing");

    if (
      !canAccessCanvasingSite(
        isSuperAdmin,
        permissions,
        session,
        existingRequest,
      )
    ) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menolak canvasing",
      );
    }

    const request = await service.rejectRequest(id);

    return apiSuccess(request, { message: "Canvasing berhasil ditolak" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal menolak canvasing";

    if (message.includes("tidak ditemukan")) {
      return ApiErrors.notFound("Data canvasing");
    }

    if (message.includes("PENDING") || message.includes("invalid")) {
      return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    return ApiErrors.internalError(message);
  }
}
