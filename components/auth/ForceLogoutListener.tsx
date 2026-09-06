"use client";

import React from "react";
import { signOutToPortalLogin } from "@/lib/auth/sign-out";
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
      void signOutToPortalLogin();
    }, 1000);
  });

  return null;
}
