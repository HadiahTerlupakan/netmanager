import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationsForUser,
  getUnreadCount,
  markAllAsRead,
  type NotificationType,
} from "@/modules/notification";
import { requireAuth } from "@/lib/auth-helpers";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { socketEmitter } from "@/lib/websocket/emitter";

interface ExtendedUser {
  id: string;
  role: string;
  siteId?: string;
  departmentId?: string;
}

// GET /api/notifications - Get notifications for current user
export async function GET(request: NextRequest) {
  try {
    // Cek autentikasi menggunakan fungsi terpusat
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type") as NotificationType | undefined;
    const excludeTypes = searchParams.get("excludeTypes")?.split(",") as
      | NotificationType[]
      | undefined;

    // Enforce Site Restriction
    const permissions = await getUserPermissions(session.user.id);
    const user = session.user as ExtendedUser & { isSuperAdmin?: boolean };
    const isSuper = isSuperAdmin(user);
    const siteId =
      !isSuper && permissions.includes("site_only") ? user.siteId : undefined;
    const departmentId = user.departmentId || undefined;

    const options: Parameters<typeof getNotificationsForUser>[1] = {
      unreadOnly,
      limit,
      offset,
    };

    if (type) options.type = type;
    if (excludeTypes) options.excludeTypes = excludeTypes;
    if (siteId) options.siteId = siteId;
    if (departmentId) options.departmentId = departmentId;

    // Optimized: Run queries in parallel
    const [notificationData, unreadCount] = await Promise.all([
      getNotificationsForUser(session.user.id, options),
      getUnreadCount(session.user.id, excludeTypes, siteId),
    ]);

    return NextResponse.json({
      success: true,
      notifications: notificationData.notifications,
      total: notificationData.total,
      unreadCount,
    });
  } catch (error) {
    logger.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Gagal mengambil notifikasi" },
      { status: 500 },
    );
  }
}

// PATCH /api/notifications - Mark all as read
export async function PATCH(request: NextRequest) {
  try {
    // Cek autentikasi menggunakan fungsi terpusat
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const body = await request.json().catch(() => ({}));
    const type = body.type as NotificationType | undefined;

    // Enforce Site Restriction
    const permissions = await getUserPermissions(session.user.id);
    const user = session.user as ExtendedUser & { isSuperAdmin?: boolean };
    const isSuper = isSuperAdmin(user);
    const siteId =
      !isSuper && permissions.includes("site_only") ? user.siteId : undefined;

    await markAllAsRead(session.user.id, type, siteId);
    const unreadCount = await getUnreadCount(
      session.user.id,
      undefined,
      siteId,
    );
    socketEmitter.updateNotificationCount(session.user.id, unreadCount);

    return NextResponse.json({
      success: true,
      message: "Semua notifikasi telah ditandai dibaca",
    });
  } catch (error) {
    logger.error("Error marking notifications as read:", error);
    return NextResponse.json(
      { error: "Gagal menandai notifikasi sebagai dibaca" },
      { status: 500 },
    );
  }
}
