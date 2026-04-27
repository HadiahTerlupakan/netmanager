import { NextRequest, NextResponse } from "next/server";
import { getMobileAuthPayload } from "@/lib/mobile-api-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  updateMobileFcmToken,
  MobileFcmTokenError,
} from "@/modules/notification";

// POST /api/mobile/mitra/fcm-token — Save or remove mitra FCM token
export async function POST(req: NextRequest) {
  try {
    const authResult = await getMobileAuthPayload(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!authResult.userId || authResult.role !== "MITRA") {
      return ApiErrors.unauthorized("Sesi tidak valid atau bukan Mitra");
    }

    const { fcmToken, action } = await req.json();
    if (!fcmToken) return ApiErrors.badRequest("fcmToken wajib diisi");

    const result = await updateMobileFcmToken({
      session: {
        id: authResult.id as string,
        userId: authResult.userId as string,
        tenantId: authResult.tenantId as string | null,
        role: authResult.role,
      },
      fcmToken,
      action,
      successMessages: {
        add: "FCM Token Mitra berhasil disimpan",
        remove: "FCM Token Mitra dihapus",
      },
    });

    return apiSuccess(null, { message: result.message });
  } catch (error) {
    if (error instanceof MobileFcmTokenError) {
      return buildFcmErrorResponse(error.message, error.status);
    }

    console.error("Error FCM Token Mitra API:", error);
    return ApiErrors.internalError("Terjadi kesalahan pada server");
  }
}

/** Memetakan error FCM service ke response API standar. */
function buildFcmErrorResponse(message: string, status: number) {
  if (status === 401) return ApiErrors.unauthorized(message);
  if (status === 404) return ApiErrors.notFound(message);
  return ApiErrors.badRequest(message);
}
