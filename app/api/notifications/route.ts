import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationsForUser,
  getUnreadCount,
  markAllAsRead,
  type NotificationType,
} from "@/modules/notification/api";
import { requireAuth } from "@/lib/auth-helpers";
import { isSuperAdmin } from "@/lib/auth";
import { socketEmitter } from "@/lib/websocket/emitter";
import { runWithRequestTenantContext } from "@/lib/tenant-context";
import {
  getNotificationRouteScope,
  type NotificationRouteUser,
} from "./route-helpers";

interface ExtendedUser extends NotificationRouteUser {
  id: string;
}

function runNotificationRouteWithTenant<T>(
  user: ExtendedUser,
  callback: () => Promise<T>,
) {
  return runWithRequestTenantContext(
    {
      tenantId: user.tenantId ?? null,
      isSuperAdmin: isSuperAdmin(user),
    },
    callback,
  );
}

// GET /api/notifications - Get notifications for current user
export async function GET(request: NextRequest) {
  try {
    // Cek autentikasi menggunakan fungsi terpusat
    const session = await requireAuth(request);
    if (session instanceof NextResponse) {
      return session;
    }

    const user = session.user as ExtendedUser;

    return runNotificationRouteWithTenant(user, async () => {
      const { searchParams } = new URL(request.url);
      const unreadOnly = searchParams.get("unread") === "true";
      const limit = parseInt(searchParams.get("limit") || "50");
      const offset = parseInt(searchParams.get("offset") || "0");
      const type = searchParams.get("type") as NotificationType | undefined;
      const excludeTypes = searchParams.get("excludeTypes")?.split(",") as
        | NotificationType[]
        | undefined;
      const includeTotal = searchParams.get("includeTotal") !== "false";

      const { siteId, departmentId } = getNotificationRouteScope(user);

      const options: Parameters<typeof getNotificationsForUser>[1] = {
        unreadOnly,
        limit,
        offset,
      };

      if (type) options.type = type;
      if (excludeTypes) options.excludeTypes = excludeTypes;
      if (siteId) options.siteId = siteId;
      if (departmentId) options.departmentId = departmentId;
      if (!includeTotal) options.includeTotal = false;

      const [notificationData, unreadCount] = await Promise.all([
        getNotificationsForUser(user.id, options),
        getUnreadCount(user.id, excludeTypes, siteId, departmentId),
      ]);

      return NextResponse.json({
        success: true,
        notifications: notificationData.notifications,
        ...(notificationData.total !== undefined
          ? { total: notificationData.total }
          : {}),
        unreadCount,
      });
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

    const user = session.user as ExtendedUser;

    return runNotificationRouteWithTenant(user, async () => {
      const body = (await request
        .json()
        .catch(() => ({}) as { type?: NotificationType })) as {
        type?: NotificationType;
      };
      const type = body.type;

      const { siteId, departmentId } = getNotificationRouteScope(user);

      await markAllAsRead(user.id, type, siteId);
      const unreadCount = await getUnreadCount(
        user.id,
        undefined,
        siteId,
        departmentId,
      );
      socketEmitter.updateNotificationCount(user.id, unreadCount);

      return NextResponse.json({
        success: true,
        message: "Semua notifikasi telah ditandai dibaca",
      });
    });
  } catch (error) {
    logger.error("Error marking notifications as read:", error);
    return NextResponse.json(
      { error: "Gagal menandai notifikasi sebagai dibaca" },
      { status: 500 },
    );
  }
}
