import { NextRequest } from "next/server";
import { createHandler, apiSuccess } from "@/lib/api";
import {
  getNotificationsForUser,
  getUnreadCount,
  markAllAsRead,
  type NotificationType,
} from "@/modules/notification/api";
import { socketEmitter } from "@/lib/websocket/emitter";
import {
  getNotificationRouteScope,
  type NotificationRouteUser,
} from "./route-helpers";

interface ExtendedUser extends NotificationRouteUser {
  id: string;
}

/** GET /api/notifications — daftar notifikasi user yang sedang login. */
export const GET = createHandler(
  { auth: true },
  async (request: NextRequest, ctx) => {
    const user: ExtendedUser = {
      ...ctx.session!.user,
      permissions: ctx.permissions,
    } as ExtendedUser;
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

    return apiSuccess({
      notifications: notificationData.notifications,
      ...(notificationData.total !== undefined
        ? { total: notificationData.total }
        : {}),
      unreadCount,
    });
  },
);

/** PATCH /api/notifications — tandai semua notifikasi user sebagai dibaca. */
export const PATCH = createHandler(
  { auth: true },
  async (request: NextRequest, ctx) => {
    const user: ExtendedUser = {
      ...ctx.session!.user,
      permissions: ctx.permissions,
    } as ExtendedUser;
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

    return apiSuccess(
      { unreadCount },
      { message: "Semua notifikasi telah ditandai dibaca" },
    );
  },
);
