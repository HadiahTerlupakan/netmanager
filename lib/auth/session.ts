import { redis } from "@/lib/redis";
import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { logger } from "@/lib/logger";

/**
 * Session caching logic
 * Cache TTL: 30 seconds
 */

const SESSION_CACHE_TTL = 30;
const SESSION_CACHE_PREFIX = "session:";

export async function getCachedSession(token: string): Promise<Session | null> {
  try {
    const cacheKey = `${SESSION_CACHE_PREFIX}${token}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as Session;
    }

    return null;
  } catch (error) {
    logger.error("Error getting cached session:", error);
    return null;
  }
}

export async function setCachedSession(
  token: string,
  session: Session,
): Promise<void> {
  try {
    const cacheKey = `${SESSION_CACHE_PREFIX}${token}`;
    await redis.setex(cacheKey, SESSION_CACHE_TTL, JSON.stringify(session));
  } catch (error) {
    logger.error("Error setting cached session:", error);
  }
}

export async function invalidateSessionCache(token: string): Promise<void> {
  try {
    const cacheKey = `${SESSION_CACHE_PREFIX}${token}`;
    await redis.del(cacheKey);
  } catch (error) {
    logger.error("Error invalidating session cache:", error);
  }
}

export function buildSessionFromToken(token: JWT): Session {
  const expTimestamp = typeof token.exp === "number" ? token.exp : 0;
  return {
    user: {
      id: token.sub || token.id || "",
      email: token.email || "",
      name: token.name || "",
      role: token.role || "USER",
      tenantId: token.tenantId || null,
      siteId: token.siteId || null,
      // Permissions are fetched separately via /api/user/permissions
      // Not stored in JWT to keep token size small
      permissions: [],
    },
    expires: new Date(expTimestamp * 1000).toISOString(),
  };
}
