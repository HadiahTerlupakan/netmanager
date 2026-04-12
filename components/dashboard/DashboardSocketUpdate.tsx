"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

const ADMIN_DASHBOARD_REFRESH_COOLDOWN_MS = 10_000;

export function DashboardSocketUpdate(): React.ReactElement | null {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useRealtimeScope({ kind: "admin", id: "mikrotik" });

  const refresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < ADMIN_DASHBOARD_REFRESH_COOLDOWN_MS) {
      return;
    }

    lastRefreshAtRef.current = now;
    router.refresh();
  }, [router]);

  useRealtimeEvent("mikrotik.update", refresh);
  return null;
}
