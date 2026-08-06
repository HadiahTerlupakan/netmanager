import { LRUCache } from "lru-cache";

// Rate limit configuration per endpoint
export const RATE_LIMITS = {
  login: 5, // 5 attempts per minute
  register: 3, // 3 registrations per minute
  resetPassword: 3, // 3 password resets per minute
  verifyOTP: 10, // 10 OTP verifications per minute
  general: 100, // 100 requests per minute (general API)
} as const;

// In-memory cache for rate limiting
// Max 500 IP addresses tracked, TTL 60 seconds (1 minute)
const rateLimitMap = new LRUCache<string, number>({
  max: 500,
  ttl: 60000, // 1 minute in milliseconds
});

/**
 * Rate limit checker
 * @param identifier - Usually IP address
 * @param limit - Maximum requests allowed per TTL window
 * @returns true if request is allowed, false if limit exceeded
 */
export function rateLimit(identifier: string, limit: number = 10): boolean {
  const count = rateLimitMap.get(identifier) || 0;

  if (count >= limit) {
    return false; // Rate limit exceeded
  }

  rateLimitMap.set(identifier, count + 1);
  return true; // Request allowed
}

/**
 * Get client IP address from request headers
 * Supports proxied requests (X-Forwarded-For, X-Real-IP)
 * @param request - Next.js Request object
 * @returns IP address string
 */
export function getClientIP(request: Request): string {
  // Try X-Forwarded-For first (standard for proxies/load balancers)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2)
    // First IP is the original client
    return forwardedFor.split(",")[0].trim();
  }

  // Try X-Real-IP (used by some proxies)
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  // Fallback for unknown (should not happen in production behind proxy)
  return "unknown";
}

/**
 * Get current rate limit count for identifier
 * Useful for debugging or displaying remaining attempts
 * @param identifier - Usually IP address
 * @returns Current count or 0 if not tracked
 */
export function getRateLimitCount(identifier: string): number {
  return rateLimitMap.get(identifier) || 0;
}

/**
 * Reset rate limit for specific identifier
 * Useful for admin override or after successful action
 * @param identifier - Usually IP address
 */
export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}
