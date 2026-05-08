import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";
import { prismaAuth } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getUserPermissions } from "./permissions";
import { isSuperAdminRole } from "./helpers";

/**
 * NextAuth callbacks untuk JWT dan Session
 */

export async function jwtCallback({
  token,
  user,
  trigger,
}: {
  token: JWT;
  user?: { id: string };
  trigger?: "signIn" | "signUp" | "update";
  session?: unknown;
}) {
  logger.info(
    "[JWT CALLBACK] Called with trigger:",
    trigger,
    "user:",
    !!user,
    "token.id:",
    token.id,
  );

  if (user) {
    token.id = user.id;
    logger.info("[JWT CALLBACK] Processing new user login:", user.id);

    try {
      const dbUser = await prismaAuth.user.findUnique({
        where: { id: user.id },
        include: {
          role: {
            include: {
              permission: true,
            },
          },
          departments: true,
          userSites: {
            include: { site: true },
            orderBy: { isPrimary: "desc" },
          },
          tenant: true,
        },
      });

      token.name = dbUser?.name;
      token.email = dbUser?.email;
      token.picture = dbUser?.image;
      token.tokenVersion = dbUser?.tokenVersion ?? 0;

      token.role = dbUser?.role?.name || "USER";
      token.accessAdminPanel = dbUser?.role?.accessAdminPanel ?? false;
      token.accessEmployeePanel = dbUser?.role?.accessEmployeePanel ?? false;
      token.isSuperAdmin = dbUser?.role?.isSuperAdmin ?? false;
      token.canApproveRab =
        (dbUser?.role as unknown as { canApproveRab?: boolean })
          ?.canApproveRab ?? false;

      token.permissionsCount = dbUser?.role?.permission.length || 0;
      // Don't store permissions array in JWT - it's fetched separately via /api/user/permissions
      // This prevents JWT token from becoming too large (>4KB cookie limit)
      token.permissions = undefined;

      token.departmentName = dbUser?.departments?.name;
      token.isSales = dbUser?.isSales ?? false;

      if (token.isSuperAdmin || isSuperAdminRole(token.role)) {
        token.accessAdminPanel = true;
        token.accessEmployeePanel = true;
        token.isSuperAdmin = true;
      }

      const userSites = dbUser?.userSites || [];
      token.siteIds = userSites.map((us) => us.siteId);
      token.primarySiteId =
        userSites.find((us) => us.isPrimary)?.siteId ||
        userSites[0]?.siteId ||
        null;

      token.departmentId = dbUser?.departmentId;
      token.siteId = token.primarySiteId || dbUser?.siteId;
      token.tenantId = dbUser?.tenantId || null;
      token.tenantName = dbUser?.tenant?.name || null;

      token.tokenVersion = dbUser?.tokenVersion ?? 0;

      logger.info("[AUTH JWT] Token initialized:", {
        id: token.id,
        role: token.role,
        department: token.departmentName,
        accessAdmin: token.accessAdminPanel,
        accessEmployee: token.accessEmployeePanel,
        permissionsCount: token.permissionsCount,
        siteCount: (token.siteIds as string[] | undefined)?.length || 0,
        primarySiteId: token.primarySiteId,
      });
    } catch (error) {
      logger.error("[AUTH JWT] Error fetching user role:", error);
      token.role = "USER";
      token.accessAdminPanel = false;
      token.accessEmployeePanel = false;
      token.permissionsCount = 0;
    }
  }

  if (trigger === "update") {
    logger.info("[JWT CALLBACK] Update trigger for user:", token.id);
    const dbUser = await prismaAuth.user.findUnique({
      where: { id: token.id as string },
      include: {
        role: {
          include: {
            permission: true,
          },
        },
        departments: true,
        userSites: {
          include: { site: true },
          orderBy: { isPrimary: "desc" },
        },
        tenant: true,
      },
    });

    if (dbUser) {
      token.siteId = token.primarySiteId || dbUser.siteId;
      token.tenantId = dbUser.tenantId || null;
      token.tenantName = dbUser.tenant?.name || null;

      token.role = dbUser.role?.name || "USER";
      token.accessAdminPanel = dbUser.role?.accessAdminPanel ?? false;
      token.accessEmployeePanel = dbUser.role?.accessEmployeePanel ?? false;
      token.isSuperAdmin = dbUser.role?.isSuperAdmin ?? false;
      token.canApproveRab =
        (dbUser.role as unknown as { canApproveRab?: boolean })
          ?.canApproveRab ?? false;

      if (token.isSuperAdmin || isSuperAdminRole(token.role)) {
        token.accessAdminPanel = true;
        token.accessEmployeePanel = true;
        token.isSuperAdmin = true;
      }

      token.permissionsCount = dbUser.role?.permission.length || 0;
      // Don't store permissions array in JWT - it's fetched separately via /api/user/permissions
      token.permissions = undefined;
    }
  }

  return token;
}

export async function sessionCallback({
  session,
  token,
}: {
  session: Session;
  token: JWT;
}) {
  if (session.user && token.id) {
    try {
      const userId = token.id as string;
      const sessionCacheKey = `session:${userId}`;
      const SESSION_CACHE_TTL = 30;

      let dbUser: {
        tokenVersion: number;
        isActive: boolean;
        role: {
          name: string;
          accessAdminPanel: boolean;
          accessEmployeePanel: boolean;
          isSuperAdmin: boolean;
          canApproveRab?: boolean;
          permission: { id: string }[];
        } | null;
        departments: { name: string } | null;
        isSales: boolean;
        siteId: string | null;
        tenantId: string | null;
        tenant: { name: string } | null;
        userSites: { siteId: string }[];
      } | null = null;

      try {
        const { redis } = await import("@/lib/redis");
        const cached = await redis.get(sessionCacheKey);
        if (cached) {
          dbUser = JSON.parse(cached);
        }
      } catch {
        // Cache read failed - continue to database
      }

      if (!dbUser) {
        dbUser = (await prismaAuth.user.findUnique({
          where: { id: userId },
          select: {
            tokenVersion: true,
            isActive: true,
            role: {
              select: {
                name: true,
                accessAdminPanel: true,
                accessEmployeePanel: true,
                isSuperAdmin: true,
                canApproveRab: true,
                permission: { select: { id: true } },
              },
            },
            departments: { select: { name: true } },
            isSales: true,
            siteId: true,
            tenantId: true,
            tenant: { select: { name: true } },
            userSites: {
              where: { isPrimary: true },
              select: { siteId: true },
              take: 1,
            },
          },
        })) as unknown as typeof dbUser;

        if (dbUser) {
          try {
            const { redis } = await import("@/lib/redis");
            await redis.setex(
              sessionCacheKey,
              SESSION_CACHE_TTL,
              JSON.stringify(dbUser),
            );
          } catch {
            // Cache write failed - continue without caching
          }
        }
      }

      if (!dbUser || !dbUser.isActive) {
        logger.info(
          `[AUTH SESSION] User ${token.id} not found or inactive. Invalidating session.`,
        );
        return {
          ...session,
          user: undefined as unknown as Session["user"],
          expires: new Date(0).toISOString(),
        };
      }

      const tokenVersion = (token.tokenVersion as number) ?? 0;
      if (dbUser.tokenVersion > tokenVersion) {
        logger.info(
          `[AUTH SESSION] Token version mismatch for user ${token.id}. DB: ${dbUser.tokenVersion}, Token: ${tokenVersion}. Forcing logout.`,
        );
        try {
          const { redis } = await import("@/lib/redis");
          await redis.del(sessionCacheKey);
        } catch {
          /* ignore */
        }
        return {
          ...session,
          user: undefined as unknown as Session["user"],
          expires: new Date(0).toISOString(),
        };
      }

      const sessionUser = session.user as Record<string, unknown>;
      sessionUser.id = token.id;

      const roleName = dbUser.role?.name || "USER";
      const isUserSuperAdmin =
        dbUser.role?.isSuperAdmin || isSuperAdminRole(roleName);

      sessionUser.role = roleName;
      sessionUser.isSuperAdmin = isUserSuperAdmin;
      sessionUser.tenantId = dbUser.tenantId || null;

      if (isUserSuperAdmin) {
        sessionUser.accessAdminPanel = true;
        sessionUser.accessEmployeePanel = true;
        sessionUser.canApproveRab = true;
      } else {
        sessionUser.accessAdminPanel = dbUser.role?.accessAdminPanel ?? false;
        sessionUser.accessEmployeePanel =
          dbUser.role?.accessEmployeePanel ?? false;
        sessionUser.canApproveRab = dbUser.role?.canApproveRab ?? false;
      }

      sessionUser.permissions =
        (token.permissions as string[] | undefined) ||
        (await getUserPermissions(userId));
      sessionUser.permissionsCount = dbUser.role?.permission.length || 0;
      sessionUser.departmentId = token.departmentId;
      sessionUser.departmentName = dbUser.departments?.name;

      const primarySiteId = dbUser.userSites?.[0]?.siteId || dbUser.siteId;
      sessionUser.siteId = primarySiteId;
      sessionUser.primarySiteId = primarySiteId;
      sessionUser.siteIds = token.siteIds;
      sessionUser.tenantName = dbUser.tenant?.name || null;

      sessionUser.isSales = dbUser.isSales;

      if (process.env.NODE_ENV === "development") {
        logger.info(
          `[AUTH SESSION] Session created for ${sessionUser.email}. Tenant: ${sessionUser.tenantId}, isSuper: ${sessionUser.isSuperAdmin}`,
        );
      }
    } catch (error) {
      logger.error("[AUTH SESSION] Error validating tokenVersion:", error);
      logger.warn(
        "[AUTH SESSION] SECURITY: Invalidating session due to validation error",
      );
      return {
        ...session,
        user: undefined as unknown as Session["user"],
        expires: new Date(0).toISOString(),
      };
    }
  }
  return session;
}
