"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

import { usePermission } from "@/hooks/use-permission";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

const ADMIN_DASHBOARD_REFRESH_COOLDOWN_MS = 10_000;

export function DashboardSocketUpdate(): React.ReactElement | null {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);
  const { hasPermission } = usePermission();
  const canReadMikrotik = hasPermission("mikrotik:read");

  useRealtimeScope(canReadMikrotik ? { kind: "admin", id: "mikrotik" } : null);

  const refresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshAtRef.current < ADMIN_DASHBOARD_REFRESH_COOLDOWN_MS) {
      return;
    }

    lastRefreshAtRef.current = now;
    router.refresh();
  }, [router]);

  useRealtimeEvent(
    "mikrotik.update",
    useCallback(() => {
      if (!canReadMikrotik) {
        return;
      }

      refresh();
    }, [canReadMikrotik, refresh]),
  );
  return null;
}
