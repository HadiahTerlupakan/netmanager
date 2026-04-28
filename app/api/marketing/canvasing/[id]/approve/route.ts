import { NextRequest } from "next/server";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import {
  canAccessCanvasingSite,
  createCanvasingService,
} from "@/modules/marketing";
import {
  apiSuccess,
  ApiErrors,
  apiError,
  ErrorCodes,
} from "@/lib/api-response";

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
        "Anda tidak memiliki akses untuk menyetujui canvasing",
      );
    }

    const service = createCanvasingService();
    const existingRequest = await service.getRequestByIdWithSales(id);
    if (!existingRequest) return ApiErrors.notFound("Data canvasing");

    if (
      !canAccessCanvasingSite({
        isSuperAdmin,
        permissions,
        session,
        canvasing: existingRequest,
      })
    ) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menyetujui canvasing",
      );
    }

    const request = await service.approveRequest(id, session.id);

    return apiSuccess(request, {
      message: "Canvasing berhasil disetujui dan Work Order telah dibuat",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal menyetujui canvasing";
    if (message.includes("tidak ditemukan")) {
      return ApiErrors.notFound("Data canvasing");
    }
    if (message.includes("Hanya request PENDING")) {
      return apiError(message, ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }
    return ApiErrors.internalError(message);
  }
}
