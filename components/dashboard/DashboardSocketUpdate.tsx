"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

export function DashboardSocketUpdate(): React.ReactElement | null {
  const router = useRouter();

  useRealtimeScope({ kind: "admin", id: "mikrotik" });

  const refresh = () => {
    router.refresh();
  };

  useRealtimeEvent("mikrotik.update", () => {
    refresh();
  });

  return null;
}
