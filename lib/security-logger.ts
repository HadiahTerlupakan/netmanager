import { redis } from "@/lib/redis";

export type SecurityEventType =
  | "failed_login"
  | "rate_limit_exceeded"
  | "suspicious_activity"
  | "unauthorized_access"
  | "ip_blocked";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export interface SecurityEvent {
  type: SecurityEventType;
  ipAddress: string;
  userAgent: string;
  userId?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
  severity: SecuritySeverity;
}

/**
 * Log security event to console (Kubernetes logs)
 * Does NOT store in database to avoid performance impact
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const logEntry = {
    level: "security",
    timestamp: new Date().toISOString(),
    ...event,
  };

  // Log to console based on severity
  if (event.severity === "critical" || event.severity === "high") {
    console.error(JSON.stringify(logEntry));
  } else {
    console.warn(JSON.stringify(logEntry));
  }
}

/**
 * Track failed login attempts in Redis (temporary, auto-expire)
 * @param ip - IP address
 * @returns Current count of failed attempts
 */
export async function trackFailedLogin(ip: string): Promise<number> {
  const key = `security:failed_login:${ip}`;

  try {
    const count = await redis.incr(key);

    // Set expiry on first attempt (15 minutes)
    if (count === 1) {
      await redis.expire(key, 900);
    }

    return count;
  } catch (error) {
    console.error("Failed to track login attempt in Redis:", error);
    return 0;
  }
}

/**
 * Check if IP is temporarily blocked
 * @param ip - IP address
 * @returns true if blocked, false otherwise
 */
export async function isIpBlocked(ip: string): Promise<boolean> {
  const key = `security:blocked_ip:${ip}`;

  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error("Failed to check IP block status in Redis:", error);
    return false;
  }
}

/**
 * Block IP temporarily after multiple failed attempts
 * @param ip - IP address to block
 * @param durationSeconds - Block duration (default: 1 hour)
 */
export async function blockIp(
  ip: string,
  durationSeconds: number = 3600,
): Promise<void> {
  const key = `security:blocked_ip:${ip}`;

  try {
    await redis.setex(key, durationSeconds, "1");

    // Log the block action
    logSecurityEvent({
      type: "ip_blocked",
      ipAddress: ip,
      userAgent: "system",
      severity: "high",
      details: {
        reason: "Multiple failed login attempts",
        duration: durationSeconds,
        expiresAt: new Date(Date.now() + durationSeconds * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to block IP in Redis:", error);
  }
}

/**
 * Get remaining block time for IP
 * @param ip - IP address
 * @returns Remaining seconds or 0 if not blocked
 */
export async function getBlockTimeRemaining(ip: string): Promise<number> {
  const key = `security:blocked_ip:${ip}`;

  try {
    const ttl = await redis.ttl(key);
    return ttl > 0 ? ttl : 0;
  } catch (error) {
    console.error("Failed to get TTL from Redis:", error);
    return 0;
  }
}

/**
 * Reset failed login counter (e.g., after successful login)
 * @param ip - IP address
 */
export async function resetFailedLoginCounter(ip: string): Promise<void> {
  const key = `security:failed_login:${ip}`;

  try {
    await redis.del(key);
  } catch (error) {
    console.error("Failed to reset failed login counter in Redis:", error);
  }
}
