import { NextRequest } from "next/server";
import { isTokenRevoked } from "./token-freshness";
import { getToken } from "next-auth/jwt";
import { verifyMobileToken } from "@/lib/mobile-auth";
import { logger } from "@/lib/logger";
import { getUserPermissions } from "./permissions";
import { prismaAuth } from "@/lib/prisma";

export {
  isSuperAdmin,
  isSuperAdminRole,
  isSuperAdminUser,
  type CanonicalAdminUser,
} from "./super-admin";

/**
 * Helper functions untuk authentication dan authorization
 */

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

    // Hormati pencabutan sesi. Tanpa ini, status yang dicabut (termasuk super
    // admin) tetap berlaku sampai cookie kedaluwarsa — `sessionCallback` dan
    // `verifyMobileToken` sudah memeriksanya, hanya jalur ini yang tertinggal.
    if (userId && (await isRevokedSession(userId, token))) {
      logger.info(`[AUTH_VERIFY] Session revoked for user ${userId}`);
      return null;
    }

    // Ambil permissions dari token jika sudah ada, baru fetch jika belum
    // Ini menghindari N+1 query karena session callback sudah populate permissions
    const permissions =
      (token.permissions as string[] | undefined) ||
      (userId ? await getUserPermissions(userId) : []);

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

/** Memeriksa pencabutan lewat cache sesi 30 detik yang sudah ada. */
async function isRevokedSession(
  userId: string,
  token: Record<string, unknown>,
): Promise<boolean> {
  try {
    const stored = await prismaAuth.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true, isActive: true },
    });

    if (!stored) {
      return false;
    }

    return isTokenRevoked({
      tokenVersion: token.tokenVersion as number | undefined,
      storedTokenVersion: stored.tokenVersion,
      isActive: stored.isActive,
    });
  } catch (error) {
    // Gangguan infrastruktur tidak boleh mengunci pengguna yang sah.
    logger.error("[AUTH_VERIFY] Gagal memeriksa pencabutan sesi:", error);
    return false;
  }
}
