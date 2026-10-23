// Public API for Events Module

// BillingEventDispatcher — Cross-module billing event hooks
export { BillingEventDispatcher } from './dispatchers/BillingEventDispatcher'
export { AttendanceEventDispatcher } from './dispatchers/AttendanceEventDispatcher'
export { CustomerEventDispatcher } from './dispatchers/CustomerEventDispatcher'
export { InventoryEventDispatcher } from './dispatchers/InventoryEventDispatcher'
export { NetworkEventDispatcher } from './dispatchers/NetworkEventDispatcher'
export { TicketEventDispatcher } from './dispatchers/TicketEventDispatcher'
export { WorkOrderEventDispatcher } from './dispatchers/WorkOrderEventDispatcher'

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
