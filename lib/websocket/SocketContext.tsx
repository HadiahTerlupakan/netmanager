"use client";

export {
  RealtimeProvider as SocketProvider,
  createRealtimeTransport as createSocketTransport,
} from "@/lib/realtime/RealtimeContext";

import {
  useRealtime,
  useRealtimeSubscription,
} from "@/lib/realtime/RealtimeContext";

export type SocketContextType = ReturnType<typeof useRealtime>;

export function useSocket() {
  return useRealtime();
}

export function useSocketEvent<T>(event: string, handler: (data: T) => void) {
  useRealtimeSubscription(event, handler);
}
