"use client";

import { useEffect } from "react";

import type { RealtimeScope } from "@/lib/realtime/contracts";
import { useRealtime } from "@/lib/realtime/RealtimeContext";

export function useRealtimeScope(scope: RealtimeScope | null) {
  const { subscribeScope, isConnected } = useRealtime();
  const scopeKind = scope?.kind;
  const scopeId = scope?.id;

  useEffect(() => {
    if (!scopeKind || !scopeId || !isConnected || !subscribeScope) {
      return;
    }

    return subscribeScope({ kind: scopeKind, id: scopeId });
  }, [isConnected, scopeId, scopeKind, subscribeScope]);
}
