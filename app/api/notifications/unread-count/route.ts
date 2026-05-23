import { NextRequest } from "next/server";
import { createHandler, apiSuccess } from "@/lib/api";
import {
  getUnreadCount,
  type NotificationType,
} from "@/modules/notification/api";
import { getNotificationRouteScope } from "../route-helpers";

/** GET /api/notifications/unread-count — jumlah notifikasi belum dibaca. */
export const GET = createHandler(
  { auth: true },
  async (request: NextRequest, ctx) => {
    const user = {
      ...(ctx.session!.user as {
        id: string;
        role?: string | null;
        siteId?: string | null;
        departmentId?: string | null;
        isSuperAdmin?: boolean | null;
      }),
      permissions: ctx.permissions,
    };
    const { searchParams } = new URL(request.url);
    const excludeTypes = searchParams.get("excludeTypes")?.split(",") as
      | NotificationType[]
      | undefined;

    const { siteId, departmentId } = getNotificationRouteScope(user);

    const count = await getUnreadCount(
      user.id,
      excludeTypes,
      siteId,
      departmentId,
    );

    return apiSuccess({ count });
  },
);
