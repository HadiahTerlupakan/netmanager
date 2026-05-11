import { logger } from "@/lib/logger";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import {
  getReadableNotificationForUser,
  markAsRead,
} from "@/modules/notification/api";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getNotificationRouteScope } from "../../route-helpers";

// PATCH /api/notifications/[id]/read - Mark notification as read
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authConfig);

    if (!session || !session.user) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { id } = await params;

    const { siteId, departmentId } = getNotificationRouteScope(session.user);

    const notification = await getReadableNotificationForUser(
      id,
      session.user.id,
      {
        departmentId,
        siteId,
      },
    );

    if (!notification) {
      return ApiErrors.notFound("Notifikasi tidak ditemukan");
    }

    await markAsRead(id);

    return apiSuccess(null, { message: "Notifikasi ditandai telah dibaca" });
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    return ApiErrors.internalError("Gagal menandai notifikasi sebagai dibaca");
  }
}
