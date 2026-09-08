import { logger } from "@/lib/logger";
import { Queue, type JobsOptions, type RepeatOptions } from "bullmq";
// Named import, bukan default: ioredis adalah modul CommonJS dan interop
// default-import-nya pecah setelah minifikasi webpack ("is not a constructor").
import { Redis } from "ioredis";
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
  // Parse URL and clean up malformed query params (e.g., ?family=undefined from Next.js env)
  let url = REDIS_URL;
  try {
    const parsed = new URL(REDIS_URL);
    if (parsed.searchParams.has("family")) {
      parsed.searchParams.delete("family");
    }
    // If password is empty, remove it from URL to avoid auth errors
    if (!parsed.password) {
      parsed.password = "";
    }
    url = parsed.toString().replace(/\?$/, ""); // Remove trailing ? if no params
  } catch {
    // Use URL as-is if parsing fails
  }

  const conn = new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 10) return null;
      return Math.min(times * 1000, 10000);
    },
    lazyConnect: true, // Don't connect immediately
  });
  conn.on("error", (err) => {
    if (err.message.includes("ECONNREFUSED")) {
      logger.warn("[BullMQ] Redis connection refused, retrying...");
    } else if (err.message.includes("NOAUTH")) {
      logger.warn("[BullMQ] Redis authentication issue, check REDIS_PASSWORD");
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
let _overtimeAutoCheckoutQueue: Queue | null = null;
let _attendanceAutoCheckoutQueue: Queue | null = null;
let _billingScheduleQueue: Queue | null = null;

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

    case QUEUE_NAMES.OVERTIME_AUTO_CHECKOUT:
      if (!_overtimeAutoCheckoutQueue) {
        _overtimeAutoCheckoutQueue = new Queue(
          QUEUE_NAMES.OVERTIME_AUTO_CHECKOUT,
          {
            connection: createRedisConnection(),
            defaultJobOptions: {
              attempts: 3,
              backoff: { type: "exponential", delay: 1000 },
              removeOnComplete: { age: 3600 * 24 },
              removeOnFail: { age: 3600 * 24 * 7 },
            },
          },
        );
      }
      return _overtimeAutoCheckoutQueue;

    case QUEUE_NAMES.ATTENDANCE_AUTO_CHECKOUT:
      if (!_attendanceAutoCheckoutQueue) {
        _attendanceAutoCheckoutQueue = new Queue(
          QUEUE_NAMES.ATTENDANCE_AUTO_CHECKOUT,
          {
            connection: createRedisConnection(),
            defaultJobOptions: {
              attempts: 5,
              backoff: { type: "exponential", delay: 1000 },
              removeOnComplete: { age: 3600 * 24 },
              removeOnFail: { age: 3600 * 24 * 7 },
            },
          },
        );
      }
      return _attendanceAutoCheckoutQueue;

    case QUEUE_NAMES.BILLING_SCHEDULE:
      if (!_billingScheduleQueue) {
        _billingScheduleQueue = new Queue(QUEUE_NAMES.BILLING_SCHEDULE, {
          connection: createRedisConnection(),
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: { age: 3600 * 24 },
            removeOnFail: { age: 3600 * 24 * 7 },
          },
        });
      }
      return _billingScheduleQueue;

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
  type: "expo_push" | "websocket";
  userId?: string;
  departmentId?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  pushToken?: string;
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

export interface OvertimeAutoCheckoutJobData {
  overtimeId: string;
  scheduleId: string;
  version: number;
}

export interface AttendanceAutoCheckoutJobData {
  attendanceId: string;
  tenantId: string;
  mode: "FIXED" | "SHIFT" | "FLEXIBLE" | null;
  expectedAutoCheckoutAt: string;
  sourceCheckInDate: string;
}

export interface BillingScheduleJobData {
  scheduleId: string;
  version: number;
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

  const safeJobName = `event:${eventName}`.replace(/:/g, ".");
  await queue.add(safeJobName, jobData, jobOptions);
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

/**
 * Add delayed overtime auto-checkout job.
 */
export async function addOvertimeAutoCheckoutJob(
  data: OvertimeAutoCheckoutJobData,
  options: { delay: number; jobId: string },
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.OVERTIME_AUTO_CHECKOUT);
  await queue.add("overtime-auto-checkout", data, {
    jobId: options.jobId,
    delay: options.delay,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail: { age: 3600 * 24 * 7 },
  });
}

/**
 * Remove delayed overtime auto-checkout job by id.
 */
export async function getOvertimeAutoCheckoutJob(jobId: string) {
  const queue = getQueue(QUEUE_NAMES.OVERTIME_AUTO_CHECKOUT);
  return queue.getJob(jobId);
}

export async function addAttendanceAutoCheckoutJob(
  data: AttendanceAutoCheckoutJobData,
  options: { jobId: string },
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.ATTENDANCE_AUTO_CHECKOUT);
  const existingJob = await queue.getJob(options.jobId);

  if (existingJob) {
    const state = await existingJob.getState();
    if (state === "completed" || state === "failed") {
      await existingJob.remove();
    }
  }

  await queue.add("attendance-auto-checkout", data, {
    jobId: options.jobId,
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail: { age: 3600 * 24 * 7 },
  });
}

export async function removeFailedAttendanceAutoCheckoutJob(
  jobId: string,
): Promise<boolean> {
  const queue = getQueue(QUEUE_NAMES.ATTENDANCE_AUTO_CHECKOUT);
  const job = await queue.getJob(jobId);

  if (!job) {
    return false;
  }

  const state = await job.getState();
  if (state !== "failed") {
    return false;
  }

  await job.remove();
  return true;
}

export async function removeOvertimeAutoCheckoutJob(
  jobId: string,
): Promise<void> {
  const job = await getOvertimeAutoCheckoutJob(jobId);
  if (job) {
    await job.remove();
  }
}

export async function addBillingScheduleJob(
  data: BillingScheduleJobData,
  options: { delay: number; jobId: string },
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.BILLING_SCHEDULE);
  await queue.add("billing-schedule", data, {
    jobId: options.jobId,
    delay: options.delay,
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail: { age: 3600 * 24 * 7 },
  });
}

export async function getBillingScheduleJob(jobId: string) {
  const queue = getQueue(QUEUE_NAMES.BILLING_SCHEDULE);
  return queue.getJob(jobId);
}

export async function removeBillingScheduleJob(jobId: string): Promise<void> {
  const job = await getBillingScheduleJob(jobId);
  if (job) {
    await job.remove();
  }
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
  if (_overtimeAutoCheckoutQueue) {
    closePromises.push(_overtimeAutoCheckoutQueue.close());
  }
  if (_attendanceAutoCheckoutQueue) {
    closePromises.push(_attendanceAutoCheckoutQueue.close());
  }
  if (_billingScheduleQueue) {
    closePromises.push(_billingScheduleQueue.close());
  }

  await Promise.allSettled(closePromises);

  _eventQueue = null;
  _notificationQueue = null;
  _webhookQueue = null;
  _outboxQueue = null;
  _overtimeAutoCheckoutQueue = null;
  _attendanceAutoCheckoutQueue = null;
  _billingScheduleQueue = null;

  logger.info("[BullMQ] All queues closed");
}
