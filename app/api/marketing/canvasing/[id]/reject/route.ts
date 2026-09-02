import { NextRequest } from "next/server";
import { hasCapability } from "@/lib/permission-aliases";
import { verifyAuth, getUserPermissions } from "@/lib/auth";
import { isSuperAdminRole } from "@/lib/auth-helpers";
import {
  canAccessCanvasingSite,
  createCanvasingService,
  isMarketingError,
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
      hasCapability(permissions, "canvasing:update") ||
      hasCapability(permissions, "canvasing:verify");

    if (!isSuperAdmin && !canReviewCanvasing) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk menolak canvasing",
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
        "Anda tidak memiliki akses untuk menolak canvasing",
      );
    }

    const request = await service.rejectRequest(id);

    return apiSuccess(request, { message: "Canvasing berhasil ditolak" });
  } catch (error: unknown) {
    if (isMarketingError(error)) {
      if (error.kind === "not_found") {
        return ApiErrors.notFound("Data canvasing");
      }
      if (error.kind === "invalid_status" || error.kind === "validation") {
        return apiError(error.message, ErrorCodes.VALIDATION_ERROR, {
          status: 400,
        });
      }
      if (error.kind === "forbidden") {
        return ApiErrors.forbidden(error.message);
      }
    }
    const message =
      error instanceof Error ? error.message : "Gagal menolak canvasing";
    return ApiErrors.internalError(message);
  }
}
