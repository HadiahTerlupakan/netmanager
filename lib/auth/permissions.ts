import { redis } from "@/lib/redis";
import { prismaAuth } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Permission caching logic
 * Cache TTL: 300 seconds (5 minutes)
 */

const PERMISSION_CACHE_TTL = 300;
const PERMISSION_CACHE_PREFIX = "permissions:";

export async function getUserPermissions(userId: string): Promise<string[]> {
  const cacheKey = `${PERMISSION_CACHE_PREFIX}${userId}`;
  const isDebug = process.env.NEXTAUTH_DEBUG === "true";

  if (!isDebug) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const perms = JSON.parse(cached);
        if (perms.length > 0) {
          return perms;
        }
      }
    } catch (e) {
      logger.warn("[AUTH] Redis cache read error, falling back to DB:", e);
    }
  }

  try {
    const user = await prismaAuth.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (
      user?.role?.isSuperAdmin ||
      user?.role?.name === "SUPER_ADMIN" ||
      user?.role?.name === "Super Admin"
    ) {
      const allPermissions = ["*"];

      try {
        await redis.setex(
          cacheKey,
          PERMISSION_CACHE_TTL,
          JSON.stringify(allPermissions),
        );
      } catch (e) {
        logger.warn("[AUTH] Redis cache write error:", e);
      }
      return allPermissions;
    }

    if (!user?.role?.permission || user.role.permission.length === 0) {
      logger.warn("[AUTH] User has no permissions in database", {
        userId,
        role: user?.role?.name,
      });
      return [];
    }

    const validPermissions = user.role.permission;
    const permissions = validPermissions.map(
      (p) => `${p.resource}:${p.action}`,
    );

    try {
      await redis.setex(
        cacheKey,
        PERMISSION_CACHE_TTL,
        JSON.stringify(permissions),
      );
      logger.info("[AUTH] Permissions cached from database", {
        userId,
        count: permissions.length,
      });
    } catch (e) {
      logger.warn("[AUTH] Redis cache write error:", e);
    }

    return permissions;
  } catch (error) {
    logger.error("[AUTH] Error loading permissions:", error);
    return [];
  }
}

export async function invalidatePermissionCache(userId: string): Promise<void> {
  const permCacheKey = `${PERMISSION_CACHE_PREFIX}${userId}`;
  const sessionCacheKey = `session:${userId}`;
  try {
    await redis.del(permCacheKey, sessionCacheKey);
    logger.debug("[AUTH] Permission + session cache invalidated", { userId });
  } catch (e) {
    logger.warn("[AUTH] Failed to invalidate caches:", e);
  }
}

export async function invalidateRolePermissionCache(
  roleId: string,
): Promise<void> {
  try {
    const users = await prismaAuth.user.findMany({
      where: { roleId },
      select: { id: true },
    });

    const invalidationPromises = users.map((user) =>
      invalidatePermissionCache(user.id),
    );

    await Promise.all(invalidationPromises);
    logger.debug("[AUTH] Role permission cache invalidated", {
      roleId,
      userCount: users.length,
    });
  } catch (e) {
    logger.warn("[AUTH] Failed to invalidate role permission cache:", e);
  }
}

export async function hasPermission(
  userId: string,
  resource: string,
  action: string,
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);

  if (permissions.includes("*")) return true;

  const permissionKey = `${resource}:${action}`;
  return permissions.includes(permissionKey);
}
