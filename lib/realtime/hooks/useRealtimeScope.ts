"use client";

import { useEffect, useMemo } from "react";

import type { RealtimeScope } from "@/lib/realtime/contracts";
import { useRealtime } from "@/lib/realtime/RealtimeContext";
import { SOCKET_EVENTS } from "@/lib/websocket/types";

export function buildScopeRoomName(scope: RealtimeScope): string {
  return `${scope.kind}:${scope.id}`;
}

export function useRealtimeScope(scope: RealtimeScope | null) {
  const { transport, isConnected } = useRealtime();
  const roomName = useMemo(
    () => (scope ? buildScopeRoomName(scope) : null),
    [scope],
  );

  useEffect(() => {
    if (!transport || !isConnected || !roomName) {
      return;
    }

    transport.emit(SOCKET_EVENTS.JOIN_ROOM, { room: roomName });

    return () => {
      transport.emit(SOCKET_EVENTS.LEAVE_ROOM, { room: roomName });
    };
  }, [isConnected, roomName, transport]);
}
