import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const DELAY_STEP_SECONDS = 30;
const MAX_DELAY_SECONDS = 300;

export const LOGIN_RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "Layanan login sementara tidak tersedia. Coba lagi beberapa saat.";

export type StrictLoginRateLimitResult =
  | "allowed"
  | "rate_limited"
  | "unavailable";

function sanitizeRateLimitKey(key: string): string | null {
  const safeKey = key.trim().replace(/[^a-zA-Z0-9:_-]/g, "_");
  return safeKey.length > 0 ? safeKey : null;
}

function buildBucketKey(key: string, windowSeconds: number): string {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  return `rl:${key}:${bucket}`;
}

function getDelaySeconds(count: number, maxAttempts: number): number {
  const excessAttempts = count - maxAttempts;
  return Math.min(excessAttempts * DELAY_STEP_SECONDS, MAX_DELAY_SECONDS);
}

/** Check whether strict login throttling should run in this environment. */
export function isLoginRateLimitEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.DISABLE_RATE_LIMIT !== "true"
  );
}

/** Enforce fail-closed login throttling for critical authentication flows. */
export async function checkStrictLoginRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<StrictLoginRateLimitResult> {
  const safeKey = sanitizeRateLimitKey(key);
  if (!safeKey) {
    return "allowed";
  }

  try {
    const bucketKey = buildBucketKey(safeKey, windowSeconds);
    const count = await redis.incr(bucketKey);

    if (count === 1) {
      await redis.expire(bucketKey, windowSeconds);
    }

    if (count > maxAttempts) {
      const delaySeconds = getDelaySeconds(count, maxAttempts);
      await redis.setex(`delay:${safeKey}`, delaySeconds, "1");
      return "rate_limited";
    }

    return "allowed";
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Strict login rate limit error:", message);
    return "unavailable";
  }
}
