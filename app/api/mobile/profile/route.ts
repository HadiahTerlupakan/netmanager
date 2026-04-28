import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { apiError, apiSuccess, ErrorCodes } from "@/lib/api-response";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import {
  getMobileProfileForRoute,
  hasMobileProfileUpdate,
  updateMobileProfileForRoute,
} from "@/modules/users";

export async function GET(request: Request) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const profile = await getMobileProfileForRoute(authResult);
    if (!profile) {
      return apiError(
        authResult.role === "MITRA"
          ? "Mitra tidak ditemukan"
          : "User tidak ditemukan",
        ErrorCodes.NOT_FOUND,
        { status: 404 },
      );
    }

    return apiSuccess(profile);
  } catch (error: unknown) {
    logger.error("Profile fetch error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return apiError(errorMessage, ErrorCodes.INTERNAL_ERROR, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const input = await request.json();
    if (!hasMobileProfileUpdate(input)) {
      return apiError(
        "Tidak ada field yang diubah",
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 },
      );
    }

    return apiSuccess(
      await updateMobileProfileForRoute({
        user: authResult,
        input,
      }),
    );
  } catch (error: unknown) {
    logger.error("Profile update error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    return apiError(errorMessage, ErrorCodes.INTERNAL_ERROR, { status: 500 });
  }
}
