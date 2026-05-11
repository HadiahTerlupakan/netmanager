import { isSuperAdmin } from "@/lib/auth";

export interface NotificationRouteUser {
  id?: string;
  role?: string | null;
  isSuperAdmin?: boolean | null;
  siteIds?: string[] | null;
  primarySiteId?: string | null;
  siteId?: string | null;
  departmentId?: string | null;
  tenantId?: string | null;
  permissions?: string[];
}

function getPreferredSiteId(user: NotificationRouteUser) {
  if (user.primarySiteId) {
    return user.primarySiteId;
  }

  if (user.siteIds && user.siteIds.length > 0) {
    return user.siteIds[0];
  }

  return (user as { siteId?: string | null }).siteId ?? undefined;
}

export function getNotificationRouteScope(user: NotificationRouteUser) {
  const permissions = user.permissions ?? [];
  const siteId =
    !isSuperAdmin(user) && permissions.includes("site_only")
      ? getPreferredSiteId(user)
      : undefined;

  return {
    siteId,
    departmentId: user.departmentId ?? undefined,
  };
}
