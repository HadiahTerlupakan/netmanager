"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";

import { extractOnlineUserIds } from "@/lib/realtime/client-utils";
import { getRealtimeClientServices } from "@/lib/realtime/client";
import type { PresenceSnapshot as RealtimePresenceSnapshot } from "@/lib/realtime/contracts";
import { useRealtime } from "@/lib/realtime/RealtimeContext";

export function usePresence() {
  const { isConnected } = useRealtime();
  const { realtimeDatabase } = getRealtimeClientServices();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const refreshPresence = useCallback(() => {}, []);

  useEffect(() => {
    if (!realtimeDatabase) {
      queueMicrotask(() => {
        setOnlineUsers(new Set());
      });
      return;
    }

    const presenceRef = ref(realtimeDatabase, "presence/users");

    return onValue(presenceRef, (snapshot) => {
      if (!snapshot.exists()) {
        setOnlineUsers(new Set());
        return;
      }

      const value = snapshot.val() as Record<
        string,
        RealtimePresenceSnapshot | null | undefined
      > | null;
      setOnlineUsers(
        new Set(
          extractOnlineUserIds(
            (value ?? {}) as Record<
              string,
              RealtimePresenceSnapshot | null | undefined
            >,
          ),
        ),
      );
    });
  }, [realtimeDatabase]);

  const onlineUserIds = useMemo(() => Array.from(onlineUsers), [onlineUsers]);

  return {
    isConnected,
    onlineUserIds,
    refreshPresence,
  };
}
