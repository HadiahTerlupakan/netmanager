import { Queue, type JobsOptions, type RepeatOptions } from "bullmq";
import Redis from "ioredis";
import type { EventName, QueueName } from "./types";
import { QUEUE_NAMES, JOB_PRIORITIES } from "./types";

// ============================================
// REDIS CONNECTION (shared with existing app)
// ============================================

const DEFAULT_LOCAL_REDIS_URL = "redis://localhost:6379";
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_LOCAL_REDIS_URL;

/**
 * Create a dedicated Redis connection for BullMQ.
 * BullMQ requires a separate connection for each queue/worker.
 */
function createRedisConnection(): Redis {
  const conn = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 10) return null;
      return Math.min(times * 1000, 10000);
    },
  });
  conn.on("error", (err) => {
    if (err.message.includes("ECONNREFUSED")) {
      console.warn("[BullMQ] Redis connection refused, retrying...");
    }
  });
  return conn;
}

// ============================================
// QUEUE INSTANCES
// ============================================

let _eventQueue: Queue | null = null;
let _notificationQueue: Queue | null = null;
let _webhookQueue: Queue | null = null;
let _outboxQueue: Queue | null = null;

function getQueue(name: QueueName): Queue {
  switch (name) {
    case QUEUE_NAMES.EVENTS:
      if (!_eventQueue) {
        _eventQueue = new Queue(QUEUE_NAMES.EVENTS, {
          connection: createRedisConnection(),
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: { age: 3600 * 24 }, // Keep for 24h
            removeOnFail: { age: 3600 * 24 * 7 }, // Keep failed for 7d
          },
        });
      }
      return _eventQueue;

    case QUEUE_NAMES.NOTIFICATIONS:
      if (!_notificationQueue) {
        _notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
          connection: createRedisConnection(),
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: { age: 3600 * 12 },
            removeOnFail: { age: 3600 * 24 * 7 },
          },
        });
      }
      return _notificationQueue;

    case QUEUE_NAMES.WEBHOOKS:
      if (!_webhookQueue) {
        _webhookQueue = new Queue(QUEUE_NAMES.WEBHOOKS, {
          connection: createRedisConnection(),
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: "exponential", delay: 3000 },
            removeOnComplete: { age: 3600 * 24 },
            removeOnFail: { age: 3600 * 24 * 7 },
          },
        });
      }
      return _webhookQueue;

    case QUEUE_NAMES.OUTBOX:
      if (!_outboxQueue) {
        _outboxQueue = new Queue(QUEUE_NAMES.OUTBOX, {
          connection: createRedisConnection(),
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: { age: 3600 * 24 },
            removeOnFail: { age: 3600 * 24 * 7 },
          },
        });
      }
      return _outboxQueue;

    default:
      throw new Error(`Unknown queue: ${name}`);
  }
}

// ============================================
// JOB ADDING FUNCTIONS
// ============================================

export interface EventJobData {
  eventName: EventName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
  category: string;
  timestamp: string;
}

export interface NotificationJobData {
  type: "expo_push" | "web_push" | "websocket";
  userId?: string;
  departmentId?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  pushToken?: string;
  subscription?: {
    endpoint: string;
    p256dh: string;
    auth: string;
  };
  room?: string;
  event?: string;
}

export interface WebhookJobData {
  provider: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
  signature?: string;
  headers?: Record<string, string>;
}

export interface OutboxJobData {
  outboxEventId: string;
  eventName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

/**
 * Add an event job to the events queue
 */
export async function addEventJob(
  eventName: EventName,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>,
  options?: { priority?: number; category?: string; delay?: number },
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.EVENTS);
  const jobData: EventJobData = {
    eventName,
    payload,
    category: options?.category ?? "general",
    timestamp: new Date().toISOString(),
  };

  const jobOptions: JobsOptions = {
    priority: options?.priority ?? JOB_PRIORITIES.NORMAL,
  };

  if (options?.delay) {
    jobOptions.delay = options.delay;
  }

  await queue.add(`event:${eventName}`, jobData, jobOptions);
}

/**
 * Add a notification job
 */
export async function addNotificationJob(
  data: NotificationJobData,
  options?: { priority?: number; delay?: number },
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.NOTIFICATIONS);
  const jobOptions: JobsOptions = {
    priority: options?.priority ?? JOB_PRIORITIES.NORMAL,
  };

  if (options?.delay) {
    jobOptions.delay = options.delay;
  }

  await queue.add(`notification:${data.type}`, data, jobOptions);
}

/**
 * Add a webhook processing job
 */
export async function addWebhookJob(
  data: WebhookJobData,
  options?: { priority?: number; delay?: number },
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.WEBHOOKS);
  const jobOptions: JobsOptions = {
    priority: options?.priority ?? JOB_PRIORITIES.NORMAL,
  };

  if (options?.delay) {
    jobOptions.delay = options.delay;
  }

  await queue.add(`webhook:${data.provider}`, data, jobOptions);
}

/**
 * Add an outbox processing job
 */
export async function addOutboxJob(
  data: OutboxJobData,
  options?: { priority?: number; delay?: number },
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.OUTBOX);
  const jobOptions: JobsOptions = {
    priority: options?.priority ?? JOB_PRIORITIES.NORMAL,
  };

  if (options?.delay) {
    jobOptions.delay = options.delay;
  }

  await queue.add("process-outbox-event", data, jobOptions);
}

/**
 * Add a recurring job for the outbox processor
 */
export async function addOutboxRecurringJob(
  repeatOpts: RepeatOptions = { every: 5000 }, // Every 5 seconds
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.OUTBOX);
  await queue.add(
    "outbox-poll",
    { type: "poll" },
    {
      repeat: repeatOpts,
      jobId: "outbox-poll-recurring", // Prevents duplicate recurring jobs
      removeOnComplete: { age: 60 },
      removeOnFail: { age: 3600 },
    },
  );
}

// ============================================
// QUEUE STATISTICS
// ============================================

export async function getQueueStats(): Promise<
  Record<
    string,
    {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    }
  >
> {
  const stats: Record<
    string,
    {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    }
  > = {};

  for (const queueName of Object.values(QUEUE_NAMES)) {
    try {
      const queue = getQueue(queueName);
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);
      stats[queueName] = { waiting, active, completed, failed, delayed };
    } catch {
      stats[queueName] = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  return stats;
}

/**
 * Gracefully close all queues
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (_eventQueue) closePromises.push(_eventQueue.close());
  if (_notificationQueue) closePromises.push(_notificationQueue.close());
  if (_webhookQueue) closePromises.push(_webhookQueue.close());
  if (_outboxQueue) closePromises.push(_outboxQueue.close());

  await Promise.allSettled(closePromises);

  _eventQueue = null;
  _notificationQueue = null;
  _webhookQueue = null;
  _outboxQueue = null;

  console.log("[BullMQ] All queues closed");
}
