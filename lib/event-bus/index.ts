/**
 * Event Bus Module — Public API
 *
 * Centralized Event-Driven Architecture for RadPro.
 *
 * Architecture:
 * ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
 * │  Domain Code │───>│  EventBus   │───>│  BullMQ Queue│
 * │  (Services)  │    │  (publish)  │    │  (async jobs)│
 * └──────────────┘    └──────┬──────┘    └──────┬───────┘
 *                            │                   │
 *                     ┌──────▼──────┐    ┌──────▼───────┐
 *                     │   Outbox    │    │   Workers    │
 *                     │  (Prisma)   │    │  (handlers)  │
 *                     └─────────────┘    └──────┬───────┘
 *                                               │
 *                                        ┌──────▼───────┐
 *                                        │  WebSocket   │
 *                                        │  Push Notif  │
 *                                        │  Cross-Mod   │
 *                                        └──────────────┘
 *
 * Usage:
 * ```typescript
 * import { eventBus, EVENT_NAMES } from '@/lib/event-bus'
 *
 * // Publish an event
 * await eventBus.publish(EVENT_NAMES.INVOICE_PAID, {
 *   invoiceId: 'inv-123',
 *   pelangganId: 'cust-456',
 *   amount: 100000,
 *   paidAt: new Date().toISOString(),
 * })
 *
 * // Subscribe to events
 * eventBus.on(EVENT_NAMES.INVOICE_PAID, async (payload) => {
 *   console.log(`Invoice ${payload.invoiceId} paid!`)
 * })
 * ```
 */

// Core Event Bus
export { eventBus } from './event-bus'

// Types & Constants
export {
  EVENT_NAMES,
  EVENT_CATEGORIES,
  QUEUE_NAMES,
  JOB_PRIORITIES,
  EVENT_METADATA,
} from './types'

export type {
  EventName,
  EventCategory,
  EventPayloadMap,
  EventMetadata,
  QueueName,
  BaseEventPayload,
  InvoiceCreatedPayload,
  InvoicePaidPayload,
  CustomerCreatedPayload,
  CustomerStatusPayload,
  WorkOrderCreatedPayload,
  WorkOrderAssignedPayload,
  WorkOrderUpdatedPayload,
  WorkOrderCompletedPayload,
  WorkOrderActivityPayload,
  TicketCreatedPayload,
  TicketReplyPayload,
  InventoryPayload,
  AttendancePayload,
  NetworkDevicePayload,
  NotificationPayload,
  PushNotificationPayload,
  SystemEventPayload,
} from './types'

// Outbox (for transactional event persistence)
export {
  saveToOutbox,
  saveToOutboxTx,
  getOutboxStats,
  cleanupOldEvents,
} from './outbox'

// Queues (for direct queue access)
export {
  addEventJob,
  addNotificationJob,
  addWebhookJob,
  addOutboxJob,
  getQueueStats,
  closeAllQueues,
} from './queues'

export type {
  EventJobData,
  NotificationJobData,
  WebhookJobData,
  OutboxJobData,
} from './queues'

// Workers (for startup/shutdown)
export {
  startWorkers,
  stopWorkers,
  registerEventHandler,
  getWorkerStatus,
} from './workers'

// Outbox Processor (for polling)
export {
  startOutboxProcessor,
  stopOutboxProcessor,
  runOutboxCycle,
} from './outbox-processor'

/**
 * Initialize the full event-driven system.
 * Call this once during application startup (in server.ts).
 */
export async function initializeEventBus(): Promise<void> {
  const { startWorkers } = await import('./workers')
  const { startOutboxProcessor } = await import('./outbox-processor')

  startWorkers()
  startOutboxProcessor()

  console.log('[EventBus] Initialized: workers + outbox processor')
}

/**
 * Shutdown the event-driven system gracefully.
 * Call this during application shutdown (SIGTERM/SIGINT).
 */
export async function shutdownEventBus(): Promise<void> {
  const { stopWorkers } = await import('./workers')
  const { stopOutboxProcessor } = await import('./outbox-processor')
  const { closeAllQueues } = await import('./queues')

  stopOutboxProcessor()
  await stopWorkers()
  await closeAllQueues()

  console.log('[EventBus] Shutdown complete')
}
