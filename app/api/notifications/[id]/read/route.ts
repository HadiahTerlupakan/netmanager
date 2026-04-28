import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import {
  getReadableNotificationForUser,
  markAsRead,
} from "@/modules/notification";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";

// PATCH /api/notifications/[id]/read - Mark notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authConfig);

    if (!session || !session.user) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { id } = await params;

    const permissions = await getUserPermissions(session.user.id);
    const siteId =
      !isSuperAdmin(session.user) && permissions.includes("site_only")
        ? session.user.siteId || undefined
        : undefined;

    const notification = await getReadableNotificationForUser(
      id,
      session.user.id,
      {
        departmentId: session.user.departmentId || undefined,
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
