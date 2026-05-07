import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { logger } from "@/lib/logger";
import { getUserPermissions } from "./permissions";

/**
 * Helper functions untuk authentication dan authorization
 */

export interface CanonicalAdminUser {
  role?: string | null;
  isSuperAdmin?: boolean | null;
}

export function isSuperAdminUser(
  user: CanonicalAdminUser | undefined | null,
): boolean {
  if (!user) {
    return false;
  }

  if (user.isSuperAdmin === true) {
    return true;
  }

  return user.role === "SUPER_ADMIN" || user.role === "Super Admin";
}

export function isSuperAdmin(
  user: { role?: string | null; isSuperAdmin?: boolean } | undefined | null,
): boolean {
  return isSuperAdminUser(user);
}

export function isSuperAdminRole(roleName: string | undefined | null): boolean {
  return roleName === "SUPER_ADMIN" || roleName === "Super Admin";
}

export interface UserSession {
  id: string;
  email: string;
  name: string | null;
  tenantId: string | null;
  role: string | undefined;
  departmentId: string | undefined;
  siteId: string | undefined;
  siteIds: string[];
  primarySiteId: string | undefined;
  permissions: string[] | undefined;
  isSuperAdmin?: boolean;
  canApproveRab?: boolean;
}

export async function verifyAuth(
  request: NextRequest,
): Promise<UserSession | null> {
  try {
    const authHeader = request.headers.get("Authorization");
    logger.info(
      "[AUTH_VERIFY] Authorization header:",
      authHeader ? authHeader.substring(0, 15) + "..." : "Missing",
    );

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token === "null" || !token) {
        logger.warn('[AUTH_VERIFY] Bearer token is literal "null" or empty');
        return null;
      }

      const mobilePayload = await verifyMobileToken(token);

      if (mobilePayload) {
        logger.info(
          "[AUTH_VERIFY] Mobile token verified for:",
          mobilePayload.email,
        );
        const mp = mobilePayload as Record<string, unknown>;
        return {
          id: mobilePayload.userId,
          email: mobilePayload.email as string,
          name: mobilePayload.name as string | null,
          tenantId: (mp.tenantId as string | null) || null,
          role: mobilePayload.role as string | undefined,
          departmentId: mp.departmentId as string | undefined,
          siteId: (mp.primarySiteId || mp.siteId) as string | undefined,
          siteIds:
            (mp.siteIds as string[]) ||
            (mp.siteId ? [mp.siteId as string] : []),
          primarySiteId: mp.primarySiteId as string | undefined,
          permissions: mp.permissions as string[] | undefined,
          isSuperAdmin: mobilePayload.isSuperAdmin as boolean | undefined,
          canApproveRab: mobilePayload.canApproveRab as boolean | undefined,
        };
      } else {
        logger.warn("[AUTH_VERIFY] Mobile token verification failed");
      }
    }

    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "",
    });

    if (!token) {
      logger.info("[AUTH_VERIFY] No valid session or Bearer token found");
      return null;
    }

    const userId = (token.id as string) || "";
    const permissions = userId ? await getUserPermissions(userId) : [];

    return {
      id: userId,
      email: (token.email as string) || "",
      name: (token.name as string) || null,
      tenantId: (token.tenantId as string | null) || null,
      role: token.role as string | undefined,
      departmentId: token.departmentId as string | undefined,
      siteId: token.siteId as string | undefined,
      siteIds:
        (token.siteIds as string[]) ||
        (token.siteId ? [token.siteId as string] : []),
      primarySiteId: token.primarySiteId as string | undefined,
      permissions,
      isSuperAdmin: (token.isSuperAdmin as boolean) || false,
      canApproveRab: (token.canApproveRab as boolean) || false,
    };
  } catch (error) {
    logger.error("[AUTH_VERIFY] Error verifying auth:", error);
    return null;
  }
}
