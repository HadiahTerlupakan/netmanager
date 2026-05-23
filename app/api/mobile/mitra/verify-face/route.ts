import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import {
  apiError,
  apiSuccess,
  ApiErrors,
  ErrorCodes,
} from "@/lib/api-response";
import { getMobileMitraRouteService } from "@/modules/mitra";

// POST /api/mobile/mitra/verify-face — Verify mitra face with uploaded photo
export async function POST(request: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (authResult.role !== "MITRA") {
      return apiError(
        "Akses ditolak. Fitur ini hanya untuk Mitra.",
        ErrorCodes.FORBIDDEN,
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const photo = formData.get("photo") as File | null;
    const result = await getMobileMitraRouteService().verifyFace(
      {
        id: authResult.id as string,
        userId: authResult.userId as string | undefined,
        tenantId: authResult.tenantId as string | null,
        role: authResult.role,
      },
      photo,
    );

    if (result.success === false) {
      return buildErrorResponse(result.error, result.status);
    }

    return apiSuccess(result.data);
  } catch (error) {
    logger.error("Face Verification Error:", error);
    return apiError("Terjadi kesalahan sistem.", ErrorCodes.INTERNAL_ERROR, {
      status: 500,
    });
  }
}

/** Memetakan hasil service menjadi response error API standar. */
function buildErrorResponse(message?: string, status?: number) {
  if (status === 404) return ApiErrors.notFound(message || "Mitra");
  return apiError(
    message || "Foto tidak ditemukan",
    ErrorCodes.VALIDATION_ERROR,
    { status: status || 400 },
  );
}
