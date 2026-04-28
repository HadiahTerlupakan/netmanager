import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  MobileFcmTokenError,
  updateMobileFcmToken,
} from "@/modules/notification";

export async function POST(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { fcmToken, action = "add" } = await req.json();
    if (!fcmToken) {
      return ApiErrors.badRequest("fcmToken wajib diisi");
    }

    const result = await updateMobileFcmToken({
      session: authResult,
      fcmToken,
      action,
    });

    return apiSuccess(null, { message: result.message });
  } catch (error) {
    if (error instanceof MobileFcmTokenError) {
      if (error.status === 401) {
        return ApiErrors.unauthorized(error.message);
      }

      if (error.status === 404) {
        return ApiErrors.notFound(error.message);
      }
    }

    logger.error("Error FCM token mobile API:", error);
    return ApiErrors.internalError("Terjadi kesalahan pada server");
  }
}
