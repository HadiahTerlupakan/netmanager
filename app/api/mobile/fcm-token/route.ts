import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getMobileOrCustomerAuthPayload } from "@/lib/mobile-api-auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  fcmTokenRequestSchema,
  MobileFcmTokenError,
  updateMobileFcmToken,
} from "@/modules/notification";
import {
  limitFcmTokenRequest,
  mobileFcmTokenPrincipal,
} from "../fcm-token-rate-limit";

/** Daftarkan (`add`) atau lepas (`remove`) token FCM karyawan, mitra, atau pelanggan. */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getMobileOrCustomerAuthPayload(req);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const limited = limitFcmTokenRequest(mobileFcmTokenPrincipal(authResult));
    if (limited) return limited;

    const body: unknown = await req.json().catch((): null => null);
    const parsed = fcmTokenRequestSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.badRequest("fcmToken tidak valid");
    }

    const result = await updateMobileFcmToken({
      session: authResult,
      fcmToken: parsed.data.fcmToken,
      action: parsed.data.action,
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
