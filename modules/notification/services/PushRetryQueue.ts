import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

import {
  createEmptyRetryStats,
  createRetryItem,
  isRedisUnavailableError,
  logDroppedRetryItem,
  MAX_RETRIES,
  markRetryAttempt,
  parseRetryItem,
  removeProcessingItem,
  RETRY_INTERVAL_MS,
  RETRY_PROCESSING_KEY,
  RETRY_QUEUE_KEY,
  requeueRetryItem,
  sendRetryExpoPush,
  shouldDropRetryItem,
  shouldSkipRetryProcessing,
  type PushRetryItem,
  type RetryQueueStats,
} from "./PushRetryQueue.helpers";

/**
 * Enqueue a failed push notification for retry
 */
export async function enqueuePushRetry(
  item: Omit<PushRetryItem, "id" | "retryCount" | "createdAt">,
): Promise<void> {
  try {
    await redis.lpush(RETRY_QUEUE_KEY, JSON.stringify(createRetryItem(item)));
  } catch (error) {
    logger.error("[PushRetry] Failed to enqueue:", error);
  }
}

/**
 * Process the retry queue - called periodically
 */
export async function processRetryQueue(): Promise<RetryQueueStats> {
  const stats = createEmptyRetryStats();
  if (shouldSkipRetryProcessing()) {
    return stats;
  }

  try {
    await processRetryQueueBatch(stats);
  } catch (error) {
    logRetryQueueError(error);
  }

  return stats;
}

async function processRetryQueueBatch(stats: RetryQueueStats): Promise<void> {
  const batchSize = await resolveRetryBatchSize();
  for (let index = 0; index < batchSize; index++) {
    const rawItem = await popRetryQueueItem();
    if (!rawItem) {
      break;
    }

    await processRetryQueueItem(rawItem, stats);
  }
}

async function popRetryQueueItem(): Promise<string | null> {
  return redis.rpoplpush(RETRY_QUEUE_KEY, RETRY_PROCESSING_KEY);
}

function logRetryQueueError(error: unknown): void {
  if (!isRedisUnavailableError(error)) {
    logger.error("[PushRetry] Queue processing error:", error);
  }
}

/**
 * Retry an Expo push notification
 */
async function retryExpoPush(item: PushRetryItem): Promise<boolean> {
  return sendRetryExpoPush(item);
}

// Retry queue processor - starts a periodic check
let retryIntervalId: ReturnType<typeof setInterval> | null = null;

export function startPushRetryProcessor(): void {
  if (retryIntervalId) return;

  retryIntervalId = setInterval(runRetryProcessorSafely, RETRY_INTERVAL_MS);
}

export function stopPushRetryProcessor(): void {
  if (retryIntervalId) {
    clearInterval(retryIntervalId);
    retryIntervalId = null;
  }
}

async function resolveRetryBatchSize(): Promise<number> {
  const queueLength = await redis.llen(RETRY_QUEUE_KEY);
  return Math.min(queueLength, MAX_RETRIES * 16 + 2);
}

async function processRetryQueueItem(
  rawItem: string,
  stats: RetryQueueStats,
): Promise<void> {
  const parsedItem = parseRetryItem(rawItem);
  if (!parsedItem) {
    await removeProcessingItem(rawItem);
    return;
  }

  stats.processed++;
  const retryItem = markRetryAttempt(parsedItem);
  if (shouldDropRetryItem(retryItem)) {
    logDroppedRetryItem(retryItem);
    stats.dropped++;
    await removeProcessingItem(rawItem);
    return;
  }

  const isSuccess = await retryQueueItem(rawItem, retryItem, stats);
  if (isSuccess) {
    stats.succeeded++;
  }
}

async function retryQueueItem(
  rawItem: string,
  retryItem: PushRetryItem,
  stats: RetryQueueStats,
): Promise<boolean> {
  const canRetryExpoPush =
    retryItem.type === "expo" && Boolean(retryItem.pushToken);
  if (!canRetryExpoPush) {
    stats.dropped++;
    await removeProcessingItem(rawItem);
    return false;
  }

  try {
    const isSuccess = await retryExpoPush(retryItem);
    await removeProcessingItem(rawItem);
    if (!isSuccess) {
      await requeueRetryItem(retryItem);
    }
    return isSuccess;
  } catch (error) {
    logger.error(
      `[PushRetry] Retry attempt ${retryItem.retryCount} failed for ${retryItem.userId}:`,
      error,
    );
    await removeProcessingItem(rawItem);
    await requeueRetryItem(retryItem);
    return false;
  }
}

async function runRetryProcessorSafely(): Promise<void> {
  try {
    await processRetryQueue();
  } catch (error) {
    logger.error("[PushRetry] Processor error:", error);
  }
}

/**
 * Get current stats of the retry queue
 */
export async function getRetryQueueStats(): Promise<{
  queueLength: number;
  processingLength: number;
}> {
  try {
    const queueLength = await redis.llen(RETRY_QUEUE_KEY);
    const processingLength = await redis.llen(RETRY_PROCESSING_KEY);
    return { queueLength, processingLength };
  } catch (error) {
    logger.error("[PushRetry] Failed to get queue stats:", error);
    return { queueLength: 0, processingLength: 0 };
  }
}
