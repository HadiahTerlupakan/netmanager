// Public API for Events Module

// BillingEventDispatcher — Cross-module billing event hooks
export { BillingEventDispatcher } from './dispatchers/BillingEventDispatcher'

// Re-export the full event bus for convenience
export {
  eventBus,
  EVENT_NAMES,
  EVENT_CATEGORIES,
  QUEUE_NAMES,
  JOB_PRIORITIES,
} from '@/lib/event-bus'

export type {
  EventName,
  EventCategory,
  EventPayloadMap,
  EventMetadata,
} from '@/lib/event-bus'
