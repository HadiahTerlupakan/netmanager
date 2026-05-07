import type { Session } from "next-auth";
import { isSuperAdmin as isSuperAdminHelper } from "@/lib/auth";

/**
 * Site Restriction Logic
 * Moved from authorization-middleware.ts to avoid circular dependency
 */

export interface SiteRestrictionResult {
  isRestricted: boolean;
  siteId: string | undefined;
  siteIds: string[];
  userSiteId: string | null;
  primarySiteId: string | null;
}

interface SessionUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  isSuperAdmin?: boolean;
  permissions?: string[];
  siteId?: string | null;
  siteIds?: string[];
  primarySiteId?: string | null;
  departmentId?: string | null;
  isSales?: boolean;
  tenantId?: string | null;
}

export function checkSiteRestriction(
  session: Session | null,
  resource: string,
): SiteRestrictionResult {
  if (!session?.user) {
    return {
      isRestricted: false,
      siteId: undefined,
      siteIds: [],
      userSiteId: null,
      primarySiteId: null,
    };
  }

  const user = session.user as SessionUser;
  const permissions = user.permissions || [];

  const siteIds = user.siteIds || (user.siteId ? [user.siteId] : []);
  const primarySiteId = user.primarySiteId || user.siteId || null;
  const legacySiteId = user.siteId || null;

  if (isSuperAdminHelper(user)) {
    return {
      isRestricted: false,
      siteId: undefined,
      siteIds: [],
      userSiteId: legacySiteId,
      primarySiteId,
    };
  }

  const siteOnlyPermission = `${resource}:site_only`;
  const isRestricted = permissions.includes(siteOnlyPermission);

  if (isRestricted) {
    return {
      isRestricted: true,
      siteId: primarySiteId || undefined,
      siteIds,
      userSiteId: legacySiteId,
      primarySiteId,
    };
  }

  return {
    isRestricted: false,
    siteId: undefined,
    siteIds: [],
    userSiteId: legacySiteId,
    primarySiteId,
  };
}
