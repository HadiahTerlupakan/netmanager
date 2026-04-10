"use client";

import React from "react";
import { signOut } from "next-auth/react";
import { toast } from "react-hot-toast";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";

interface ForceLogoutPayload {
  message: string;
  timestamp: string;
}

export default function ForceLogoutListener(): React.ReactElement | null {
  useRealtimeEvent<ForceLogoutPayload>("session.force_logout", (payload) => {
    toast.error(
      payload.message || "Sesi Anda telah diakhiri oleh administrator",
      {
        duration: 5000,
        icon: "🔒",
      },
    );

    setTimeout(() => {
      signOut({ callbackUrl: "/admin/login" });
    }, 1000);
  });

  return null;
}
