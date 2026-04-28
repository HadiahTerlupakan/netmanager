import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiError, ErrorCodes } from "@/lib/api-response";
import { getMobileDashboardService } from "@/modules/mitra";
import type { MobileDashboardUserPayload } from "@/modules/mitra";
import type { MobileTokenPayload } from "@/lib/mobile-auth";

/** Normalize mobile token payload into dashboard user payload. */
function toDashboardUserPayload(
  payload: MobileTokenPayload,
): MobileDashboardUserPayload | NextResponse {
  if (!payload.userId || !payload.role || !payload.tenantId) {
    return apiError("Token mobile tidak valid", ErrorCodes.UNAUTHORIZED, {
      status: 401,
    });
  }

  return {
    id: payload.userId,
    role: payload.role,
    tenantId: payload.tenantId,
  };
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const dashboardUser = toDashboardUserPayload(authResult);
    if (dashboardUser instanceof NextResponse) {
      return dashboardUser;
    }

    const result =
      await getMobileDashboardService().getDashboardStats(dashboardUser);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server";

    if (
      message === "Mitra tidak ditemukan" ||
      message === "User tidak ditemukan"
    ) {
      return apiError(message, ErrorCodes.NOT_FOUND, { status: 404 });
    }

    return apiError("Terjadi kesalahan server", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}
