import { logger } from "@/lib/logger";
import type { EventName, EventPayloadMap, EventMetadata } from "./types";
import { EVENT_METADATA } from "./types";

/**
 * In-memory event handler type
 */
type EventHandler<T extends EventName = EventName> = (
  payload: EventPayloadMap[T],
  metadata: EventMetadata,
) => Promise<void> | void;

/**
 * EventBus - Centralized event publisher for the RadPro application
 *
 * Features:
 * - Type-safe event publishing with payload validation
 * - In-memory event handlers (synchronous)
 * - Outbox pattern support (persistent, reliable delivery)
 * - BullMQ integration (async processing)
 * - Dead letter queue for failed events
 *
 * Usage:
 * ```typescript
 * import { eventBus } from '@/lib/event-bus'
 *
 * // Subscribe to events
 * eventBus.on('billing:invoice.paid', async (payload) => {
 *   logger.info(`Invoice ${payload.invoiceId} paid!`)
 * })
 *
 * // Publish events (fire-and-forget for async, await for sync)
 * await eventBus.publish('billing:invoice.paid', {
 *   invoiceId: 'inv-123',
 *   pelangganId: 'cust-456',
 *   amount: 100000,
 *   paidAt: new Date().toISOString(),
 * })
 * ```
 */
class EventBus {
  private handlers = new Map<EventName, Set<EventHandler>>();
  private initialized = false;

  /**
   * Subscribe to an event
   */
  on<T extends EventName>(eventName: T, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventName)?.delete(handler as EventHandler);
    };
  }

  /**
   * Subscribe to an event only once
   */
  once<T extends EventName>(
    eventName: T,
    handler: EventHandler<T>,
  ): () => void {
    const wrappedHandler: EventHandler<T> = async (payload, metadata) => {
      unsubscribe();
      await handler(payload, metadata);
    };
    const unsubscribe = this.on(eventName, wrappedHandler);
    return unsubscribe;
  }

  /**
   * Publish an event synchronously to all registered handlers
   * This is used for in-process event handling (real-time)
   */
  async publish<T extends EventName>(
    eventName: T,
    payload: EventPayloadMap[T],
    options?: {
      /** Skip outbox persistence even if event metadata says persistent */
      skipOutbox?: boolean;
      /** Skip async processing even if event metadata says async */
      skipAsync?: boolean;
      /** Custom priority override */
      priority?: number;
    },
  ): Promise<void> {
    const metadata = EVENT_METADATA[eventName];
    if (!metadata) {
      logger.warn(`[EventBus] Unknown event: ${eventName}`);
      return;
    }

    // Enrich payload with timestamp if not present
    const enrichedPayload = {
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
    } as EventPayloadMap[T];

    // 1. Execute in-memory handlers (synchronous)
    const eventHandlers = this.handlers.get(eventName);
    if (eventHandlers && eventHandlers.size > 0) {
      const promises = Array.from(eventHandlers).map(async (handler) => {
        try {
          await handler(enrichedPayload, metadata);
        } catch (error) {
          logger.error(`[EventBus] Handler error for ${eventName}:`, error);
          // Don't throw — one handler failure shouldn't block others
        }
      });
      await Promise.allSettled(promises);
    }

    // 2. Persist to outbox if persistent and not skipped
    if (metadata.persistent && !options?.skipOutbox) {
      try {
        const { saveToOutbox } = await import("./outbox");
        await saveToOutbox({
          eventName,
          payload: enrichedPayload,
          priority: options?.priority ?? metadata.priority,
          category: metadata.category,
        });
      } catch (error) {
        logger.error(
          `[EventBus] Failed to save to outbox for ${eventName}:`,
          error,
        );
        // Fallback: try direct async processing
        if (metadata.async && !options?.skipAsync) {
          await this.dispatchToQueue(
            eventName,
            enrichedPayload,
            metadata,
            options?.priority,
          );
        }
      }
    }

    // 3. Dispatch to BullMQ queue if async and not skipped
    if (metadata.async && !options?.skipAsync) {
      await this.dispatchToQueue(
        eventName,
        enrichedPayload,
        metadata,
        options?.priority,
      );
    }
  }

  /**
   * Dispatch event to BullMQ queue for async processing
   */
  private async dispatchToQueue<T extends EventName>(
    eventName: T,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: Record<string, any>,
    metadata: EventMetadata,
    priorityOverride?: number,
  ): Promise<void> {
    try {
      const { addEventJob } = await import("./queues");
      await addEventJob(eventName, payload, {
        priority: priorityOverride ?? metadata.priority,
        category: metadata.category,
      });
    } catch (error) {
      logger.error(
        `[EventBus] Failed to dispatch ${eventName} to queue:`,
        error,
      );
      // Queue dispatch failure is non-fatal — the outbox processor will retry
    }
  }

  /**
   * Get all registered event names
   */
  getRegisteredEvents(): EventName[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handler count for an event
   */
  getHandlerCount(eventName: EventName): number {
    return this.handlers.get(eventName)?.size ?? 0;
  }

  /**
   * Remove all handlers (useful for testing)
   */
  removeAllHandlers(): void {
    this.handlers.clear();
  }

  /**
   * Check if event bus has handlers for an event
   */
  hasHandlers(eventName: EventName): boolean {
    return (this.handlers.get(eventName)?.size ?? 0) > 0;
  }
}

// Singleton instance
const globalForEventBus = globalThis as unknown as { eventBus?: EventBus };

export const eventBus = globalForEventBus.eventBus ?? new EventBus();

if (process.env.NODE_ENV !== "production") {
  globalForEventBus.eventBus = eventBus;
}
