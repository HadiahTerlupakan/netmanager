export { SOCKET_EVENTS } from "./types";
export type {
  NotificationPayload,
  TicketPayload,
  WorkOrderPayload,
  CountPayload,
  SocketAuthData,
  SocketData,
} from "./types";

export { useRealtimeNotifications } from "./hooks/useRealtimeNotifications";
export type { Notification } from "./hooks/useRealtimeNotifications";
export { useRealtimeSupportTickets } from "./hooks/useRealtimeSupportTickets";
export type { TicketPreview } from "./hooks/useRealtimeSupportTickets";
export { useRealtimeWorkOrderActivity } from "./hooks/useRealtimeWorkOrderActivity";
export type { ActivityItem } from "./hooks/useRealtimeWorkOrderActivity";

// Server-side helper
// import { socketEmitter } from '@/lib/websocket/emitter'
