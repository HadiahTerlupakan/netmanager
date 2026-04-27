import { NextRequest } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getMobileMitraRouteService } from "@/modules/mitra";

const mobileMitraRouteService = getMobileMitraRouteService();

// GET /api/mobile/mitra/dashboard — Mitra dashboard stats
export async function GET(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof Response) return authResult;

    if (authResult.role !== "MITRA") {
      return ApiErrors.forbidden("Bukan akun mitra");
    }

    const result = await mobileMitraRouteService.getDashboard({
      id: authResult.id as string,
      userId: authResult.userId as string | undefined,
      tenantId: authResult.tenantId as string | null,
      role: authResult.role,
    });

    if (result.success === false) {
      return buildErrorResponse(result.error, result.status);
    }

    return apiSuccess(result.data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat dashboard";
    return ApiErrors.internalError(message);
  }
}

/** Memetakan hasil service menjadi response error API standar. */
function buildErrorResponse(message?: string, status?: number) {
  if (status === 403) return ApiErrors.forbidden(message);
  if (status === 404) return ApiErrors.notFound(message || "Mitra");
  return ApiErrors.badRequest(message || "Permintaan tidak valid");
}
