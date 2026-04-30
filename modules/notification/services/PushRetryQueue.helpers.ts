import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const ONE_HOUR_MS = 3_600_000;
const EXPO_SOUND = "default";

export const RETRY_QUEUE_KEY = "push:retry:queue";
export const RETRY_PROCESSING_KEY = "push:retry:processing";
export const MAX_RETRIES = 3;
export const RETRY_INTERVAL_MS = 30_000;
const REDIS_NOT_WRITABLE_MESSAGE =
  "Stream isn't writeable and enableOfflineQueue options is false";

export interface PushRetryItem {
  id: string;
  type: "expo";
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  retryCount: number;
  createdAt: number;
  lastAttemptAt?: number;
  pushToken?: string;
}

export type RetryQueueStats = {
  processed: number;
  succeeded: number;
  dropped: number;
};

/** Return empty retry queue stats payload. */
export function createEmptyRetryStats(): RetryQueueStats {
  return { processed: 0, succeeded: 0, dropped: 0 };
}

/** Check whether Redis queue processing should be skipped. */
export function shouldSkipRetryProcessing(): boolean {
  return (redis as { status?: string }).status !== "ready";
}

/** Detect Redis writeability errors that should be ignored. */
export function isRedisUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(REDIS_NOT_WRITABLE_MESSAGE);
}

/** Build a retry queue item for one failed push payload. */
export function createRetryItem(
  item: Omit<PushRetryItem, "id" | "retryCount" | "createdAt">,
): PushRetryItem {
  return {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    retryCount: 0,
    createdAt: Date.now(),
  };
}

/** Parse one raw Redis queue entry into a retry item. */
export function parseRetryItem(rawItem: string): PushRetryItem | null {
  try {
    return JSON.parse(rawItem) as PushRetryItem;
  } catch {
    return null;
  }
}

/** Increase retry counters before processing one queue item. */
export function markRetryAttempt(item: PushRetryItem): PushRetryItem {
  return {
    ...item,
    retryCount: item.retryCount + 1,
    lastAttemptAt: Date.now(),
  };
}

/** Decide whether one retry item should be dropped. */
export function shouldDropRetryItem(item: PushRetryItem): boolean {
  return (
    item.retryCount > MAX_RETRIES || Date.now() - item.createdAt > ONE_HOUR_MS
  );
}

/** Remove one entry from the processing list. */
export async function removeProcessingItem(rawItem: string): Promise<void> {
  await redis.lrem(RETRY_PROCESSING_KEY, 1, rawItem);
}

/** Requeue one retry item for the next cycle. */
export async function requeueRetryItem(item: PushRetryItem): Promise<void> {
  await redis.lpush(RETRY_QUEUE_KEY, JSON.stringify(item));
}

/** Retry one Expo push payload against the Expo API. */
export async function sendRetryExpoPush(item: PushRetryItem): Promise<boolean> {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        to: item.pushToken,
        title: item.title,
        body: item.body,
        data: item.data || {},
        sound: EXPO_SOUND,
      },
    ]),
  });

  if (!response.ok) {
    return false;
  }

  const result = await response.json();
  return result.data?.[0]?.status === "ok";
}

/** Log one dropped retry item consistently. */
export function logDroppedRetryItem(item: PushRetryItem): void {
  logger.warn(
    `[PushRetry] Dropping push for user ${item.userId} after ${item.retryCount} retries`,
  );
}
