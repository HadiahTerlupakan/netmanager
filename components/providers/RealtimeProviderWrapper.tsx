"use client";

import { RealtimeProvider } from "@/lib/realtime/RealtimeContext";
import { type ReactNode } from "react";

interface RealtimeProviderWrapperProps {
  children: ReactNode;
}

export default function RealtimeProviderWrapper({
  children,
}: RealtimeProviderWrapperProps) {
  return <RealtimeProvider>{children}</RealtimeProvider>;
}
