import { NextRequest } from "next/server";
import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  getReadableNotificationForUser,
  getUnreadCount,
  markAsRead,
} from "@/modules/notification/api";
import { socketEmitter } from "@/lib/websocket/emitter";
import { getNotificationRouteScope } from "../route-helpers";

/** PATCH /api/notifications/[id] — tandai satu notifikasi user sebagai dibaca. */
export const PATCH = createHandler(
  { auth: true },
  async (_req: NextRequest, ctx) => {
    const id = ctx.params.id as string;
    const user = {
      ...ctx.session!.user,
      permissions: ctx.permissions,
    };
    const { siteId, departmentId } = getNotificationRouteScope(user);

    const notification = await getReadableNotificationForUser(id, user.id, {
      departmentId,
      siteId,
    });

    if (!notification) {
      return ApiErrors.notFound("Notifikasi");
    }

    await markAsRead(id);
    const unreadCount = await getUnreadCount(
      user.id,
      undefined,
      siteId,
      departmentId,
    );
    socketEmitter.updateNotificationCount(user.id, unreadCount);

    return apiSuccess(
      { unreadCount },
      { message: "Notifikasi telah ditandai dibaca" },
    );
  },
);
