import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig, getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getUnreadCount, type NotificationType } from "@/modules/notification";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

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

    const permissions = await getUserPermissions(session.user.id);
    const user = session.user as {
      role?: string;
      siteId?: string;
      departmentId?: string;
    };
    const isSuper = isSuperAdmin(user);
    const siteId =
      !isSuper && permissions.includes("site_only") ? user.siteId : undefined;

    const count = await getUnreadCount(session.user.id, excludeTypes, siteId);

    return apiSuccess({ count });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return apiSuccess({ count: 0 });
  }
}
