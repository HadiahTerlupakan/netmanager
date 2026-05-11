import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
  getReadableNotificationForUser,
  getUnreadCount,
  markAsRead,
} from "@/modules/notification/api";
import { socketEmitter } from "@/lib/websocket/emitter";
import { requireAuth } from "@/lib/auth-helpers";
import { getNotificationRouteScope } from "../route-helpers";

// PATCH /api/notifications/[id] - Mark single notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
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
      return NextResponse.json(
        { error: "Notifikasi tidak ditemukan" },
        { status: 404 },
      );
    }

    await markAsRead(id);
    const unreadCount = await getUnreadCount(
      session.user.id,
      undefined,
      siteId,
      departmentId,
    );
    socketEmitter.updateNotificationCount(session.user.id, unreadCount);

    return NextResponse.json({
      success: true,
      message: "Notifikasi telah ditandai dibaca",
    });
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    return NextResponse.json(
      { error: "Gagal menandai notifikasi sebagai dibaca" },
      { status: 500 },
    );
  }
}
