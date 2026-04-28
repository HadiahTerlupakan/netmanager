import { logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import {
  MobileFcmTokenError,
  updateMobileFcmToken,
} from "@/modules/notification";

/** Save or remove an FCM token for the current authenticated user. */
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return ApiErrors.unauthorized("Sesi tidak valid");
    }

    const { fcmToken, action = "add" } = await req.json();
    if (!fcmToken) {
      return ApiErrors.badRequest("fcmToken wajib diisi");
    }

    const result = await updateMobileFcmToken({
      session: {
        userId: session.user.id,
        role: session.user.role,
        tenantId: session.user.tenantId,
      },
      fcmToken,
      action,
      successMessages: {
        add: "FCM Token berhasil disimpan",
        remove: "FCM Token dihapus",
      },
    });

    return apiSuccess(null, { message: result.message });
  } catch (error) {
    if (error instanceof MobileFcmTokenError) {
      if (error.status === 401) {
        return ApiErrors.unauthorized("Sesi tidak valid");
      }

      if (error.status === 404) {
        return ApiErrors.notFound("User tidak ditemukan");
      }
    }

    logger.error("Error FCM Token API:", error);
    return ApiErrors.internalError("Terjadi kesalahan pada server");
  }
}
