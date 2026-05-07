import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import type { EventName, EventCategory } from "./types";

export interface OutboxEventInput {
  eventName: EventName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
  priority: number;
  category: EventCategory;
  aggregateId?: string;
  aggregateType?: string;
}

/**
 * Save an event to the outbox table.
 * This should be called within the same transaction as the business operation
 * to ensure atomicity (the event is only persisted if the business operation succeeds).
 *
 * Usage with transaction:
 * ```typescript
 * await prisma.$transaction(async (tx) => {
 *   await tx.pelanggan.create({ data: customer })
 *   await saveToOutboxTx(tx, {
 *     eventName: 'customer:created',
 *     payload: { customerId: customer.id },
 *     priority: 3,
 *     category: 'customer',
 *   })
 * })
 * ```
 */
export async function saveToOutbox(input: OutboxEventInput): Promise<string> {
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "OutboxEvent" (
      id, "eventName", payload, priority, category,
      "aggregateId", "aggregateType",
      status, "retryCount", "maxRetries",
      "createdAt", "updatedAt"
    ) VALUES (
      ${id},
      ${input.eventName},
      ${JSON.stringify(input.payload)}::jsonb,
      ${input.priority},
      ${input.category},
      ${input.aggregateId ?? null},
      ${input.aggregateType ?? null},
      'PENDING',
      0,
      5,
      NOW(),
      NOW()
    )
  `;

  return id;
}

/**
 * Save event to outbox within a Prisma transaction.
 * Use this when you need the event to be atomically persisted with the business operation.
 */
export async function saveToOutboxTx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  input: OutboxEventInput,
): Promise<string> {
  const id = randomUUID();

  await tx.$executeRaw`
    INSERT INTO "OutboxEvent" (
      id, "eventName", payload, priority, category,
      "aggregateId", "aggregateType",
      status, "retryCount", "maxRetries",
      "createdAt", "updatedAt"
    ) VALUES (
      ${id},
      ${input.eventName},
      ${JSON.stringify(input.payload)}::jsonb,
      ${input.priority},
      ${input.category},
      ${input.aggregateId ?? null},
      ${input.aggregateType ?? null},
      'PENDING',
      0,
      5,
      NOW(),
      NOW()
    )
  `;

  return id;
}

/**
 * Fetch pending events from the outbox for processing.
 * Uses SELECT FOR UPDATE SKIP LOCKED to support multiple workers.
 */
export async function fetchPendingEvents(batchSize = 50): Promise<
  Array<{
    id: string;
    eventName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: Record<string, any>;
    priority: number;
    category: string;
    retryCount: number;
    maxRetries: number;
    createdAt: Date;
  }>
> {
  // First, claim the events by setting status to PROCESSING
  const events = await prisma.$queryRaw<
    Array<{
      id: string;
      eventName: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: Record<string, any>;
      priority: number;
      category: string;
      retryCount: number;
      maxRetries: number;
      createdAt: Date;
    }>
  >`
    UPDATE "OutboxEvent"
    SET status = 'PROCESSING', "updatedAt" = NOW()
    WHERE id IN (
      SELECT id FROM "OutboxEvent"
      WHERE status = 'PENDING'
        AND ("scheduledAt" IS NULL OR "scheduledAt" <= NOW())
      ORDER BY priority ASC, "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, "eventName", payload, priority, category, "retryCount", "maxRetries", "createdAt"
  `;

  return events;
}

/**
 * Mark an outbox event as processed (completed).
 */
export async function markEventProcessed(eventId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "OutboxEvent"
    SET status = 'COMPLETED', "updatedAt" = NOW(), "processedAt" = NOW()
    WHERE id = ${eventId}
  `;
}

/**
 * Mark an outbox event as failed and increment retry count.
 * If max retries exceeded, move to DEAD state.
 */
export async function markEventFailed(
  eventId: string,
  error: string,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "OutboxEvent"
    SET
      status = CASE
        WHEN "retryCount" + 1 >= "maxRetries" THEN 'DEAD'
        ELSE 'PENDING'
      END,
      "retryCount" = "retryCount" + 1,
      "lastError" = ${error},
      "updatedAt" = NOW(),
      "scheduledAt" = CASE
        WHEN "retryCount" + 1 < "maxRetries"
        THEN NOW() + INTERVAL '1 minute' * POWER(2, "retryCount")
        ELSE NULL
      END
    WHERE id = ${eventId}
  `;
}

/**
 * Get outbox statistics for monitoring.
 */
export async function getOutboxStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  dead: number;
  total: number;
}> {
  const result = await prisma.$queryRaw<
    Array<{ status: string; count: bigint }>
  >`
    SELECT status, COUNT(*) as count
    FROM "OutboxEvent"
    WHERE "createdAt" > NOW() - INTERVAL '24 hours'
    GROUP BY status
  `;

  const stats = { pending: 0, processing: 0, completed: 0, dead: 0, total: 0 };
  for (const row of result) {
    const count = Number(row.count);
    stats.total += count;
    if (row.status in stats) {
      stats[row.status as keyof typeof stats] = count;
    }
  }

  return stats;
}

/**
 * Clean up old processed events (older than 7 days).
 * Should be called periodically (e.g., daily cron).
 */
export async function cleanupOldEvents(daysToKeep = 7): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM "OutboxEvent"
    WHERE status = 'COMPLETED'
      AND "processedAt" < NOW() - INTERVAL '1 day' * ${daysToKeep}
  `;
  return Number(result);
}
