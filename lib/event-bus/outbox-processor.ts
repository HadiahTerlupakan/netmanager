import { logger } from "@/lib/logger";
import {
  fetchPendingEvents,
  markEventProcessed,
  markEventFailed,
} from "./outbox";
import { addEventJob } from "./queues";
import { JOB_PRIORITIES } from "./types";

let processorInterval: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 5000; // Poll every 5 seconds

/**
 * Process pending events from the outbox table.
 * This is the bridge between the Outbox Pattern and BullMQ.
 *
 * Flow:
 * 1. Fetch pending events from OutboxEvent table
 * 2. For each event, dispatch to BullMQ queue
 * 3. If dispatch succeeds, mark as processed
 * 4. If dispatch fails, mark as failed (with retry logic)
 */
async function processOutbox(): Promise<{
  dispatched: number;
  failed: number;
}> {
  const stats = { dispatched: 0, failed: 0 };

  try {
    const events = await fetchPendingEvents(50);
    if (events.length === 0) return stats;

    logger.info(`[OutboxProcessor] Processing ${events.length} pending events`);

    for (const event of events) {
      try {
        // Parse the payload (Prisma returns JSONB as object)
        const payload =
          typeof event.payload === "string"
            ? JSON.parse(event.payload)
            : event.payload;

        // Dispatch to BullMQ queue
        await addEventJob(
          event.eventName as Parameters<typeof addEventJob>[0],
          payload,
          {
            priority: event.priority || JOB_PRIORITIES.NORMAL,
            category: event.category,
          },
        );

        // Mark as processed after successful queue dispatch
        await markEventProcessed(event.id);
        stats.dispatched++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          `[OutboxProcessor] Failed to dispatch event ${event.id}:`,
          errorMessage,
        );
        await markEventFailed(event.id, errorMessage);
        stats.failed++;
      }
    }
  } catch (error) {
    logger.error("[OutboxProcessor] Poll cycle error:", error);
  }

  return stats;
}

/**
 * Start the outbox processor.
 * This periodically polls the OutboxEvent table for pending events.
 */
export function startOutboxProcessor(): void {
  if (processorInterval) return; // Already running

  processorInterval = setInterval(async () => {
    try {
      await processOutbox();
    } catch (error) {
      logger.error("[OutboxProcessor] Error in poll cycle:", error);
    }
  }, POLL_INTERVAL_MS);

  logger.info(
    `[OutboxProcessor] Started (interval: ${POLL_INTERVAL_MS / 1000}s)`,
  );
}

/**
 * Stop the outbox processor.
 */
export function stopOutboxProcessor(): void {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
    logger.info("[OutboxProcessor] Stopped");
  }
}

/**
 * Run a single outbox processing cycle (for manual trigger or testing).
 */
export async function runOutboxCycle(): Promise<{
  dispatched: number;
  failed: number;
}> {
  return processOutbox();
}
