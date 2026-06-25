import { randomUUID } from "crypto";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const LOCK_RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

const DEFAULT_LOCK_TTL_SECONDS = 10;
const DEFAULT_RETRY_DELAY_MS = 50;
const DEFAULT_TIMEOUT_MS = 5000;

interface LockOptions {
  ttlSeconds?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

/**
 * Acquires a distributed Redis lock with ownership-based release.
 * Returns a release function that only the owner can invoke.
 * Returns null if the lock cannot be acquired within the timeout.
 */
export async function acquireLock(
  key: string,
  options: LockOptions = {},
): Promise<(() => Promise<void>) | null> {
  const ttl = options.ttlSeconds ?? DEFAULT_LOCK_TTL_SECONDS;
  const retryDelay = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const lockId = randomUUID();
  const lockKey = `lock:${key}`;
  const deadline = Date.now() + timeout;

  let acquired = false;
  while (!acquired && Date.now() < deadline) {
    try {
      const result = await redis.set(lockKey, lockId, "EX", ttl, "NX");
      acquired = result === "OK";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `[DistributedLock] Redis error acquiring "${key}": ${message}`,
      );
      return null;
    }
    if (!acquired) {
      await sleep(retryDelay);
    }
  }

  if (!acquired) {
    return null;
  }

  return async () => {
    try {
      await redis.eval(LOCK_RELEASE_SCRIPT, 1, lockKey, lockId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[DistributedLock] Failed to release "${key}": ${message}`);
    }
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
