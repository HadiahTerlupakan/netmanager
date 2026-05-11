import { logger } from "@/lib/logger";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/lib/auth";
import {
  getUnreadCount,
  type NotificationType,
} from "@/modules/notification/api";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getNotificationRouteScope } from "../route-helpers";

// GET /api/notifications/unread-count - Get unread notification count
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig);

    if (!session?.user?.id) {
      return ApiErrors.unauthorized("Session tidak valid");
    }

    const { searchParams } = new URL(request.url);
    const excludeTypes = searchParams.get("excludeTypes")?.split(",") as
      | NotificationType[]
      | undefined;

    const user = session.user as {
      id: string;
      role?: string | null;
      siteId?: string | null;
      departmentId?: string | null;
      permissions?: string[];
      isSuperAdmin?: boolean | null;
    };
    const { siteId, departmentId } = getNotificationRouteScope(user);

    const count = await getUnreadCount(
      session.user.id,
      excludeTypes,
      siteId,
      departmentId,
    );

    return apiSuccess({ count });
  } catch (error) {
    logger.error("Error fetching unread count:", error);
    return apiSuccess({ count: 0 });
  }
}
