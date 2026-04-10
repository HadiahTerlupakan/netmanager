"use client";

import { useRealtimeSubscription } from "@/lib/realtime/RealtimeContext";

export function useRealtimeEvent<TPayload>(
  event: string,
  handler: (payload: TPayload) => void,
) {
  useRealtimeSubscription<TPayload>(event, handler);
}
