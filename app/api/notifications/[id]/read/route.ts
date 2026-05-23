import { createHandler, apiSuccess, ApiErrors } from "@/lib/api";
import {
  getReadableNotificationForUser,
  markAsRead,
} from "@/modules/notification/api";
import { getNotificationRouteScope } from "../../route-helpers";

/** PATCH /api/notifications/[id]/read — tandai notifikasi user sebagai dibaca. */
export const PATCH = createHandler({ auth: true }, async (_req, ctx) => {
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
    return ApiErrors.notFound("Notifikasi tidak ditemukan");
  }

  await markAsRead(id);

  return apiSuccess(null, { message: "Notifikasi ditandai telah dibaca" });
});
