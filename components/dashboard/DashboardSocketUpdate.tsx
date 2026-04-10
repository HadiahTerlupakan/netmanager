"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";

export function DashboardSocketUpdate(): React.ReactElement | null {
  const router = useRouter();

  // Listen for MikroTik updates
  // We use a simple debounce mechanism: when an event comes, we don't refresh immediately
  // unless it's been a while, or we just refresh.
  // Actually, router.refresh() handles concurrent requests reasonably well,
  // but let's avoid spamming if 100 routers update at once.

  // Since useSocketEvent callback is direct, we can use a debounced refresher.

  const refresh = () => {
    router.refresh();
  };

  // Handle MikroTik updates
  useRealtimeEvent("mikrotik.update", () => {
    refresh();
  });

  // We can also listen for User updates if we implement them later
  // useSocketEvent('user:update', refresh)

  return null; // This component renders nothing
}
