"use client";

import { RealtimeProvider } from "@/lib/realtime/RealtimeContext";
import { useCustomerAuth } from "@/components/customer/CustomerAuthProvider";
import { type ReactNode } from "react";

interface CustomerRealtimeProviderWrapperProps {
  children: ReactNode;
}

export default function CustomerRealtimeProviderWrapper({
  children,
}: CustomerRealtimeProviderWrapperProps) {
  const { customer, isLoading } = useCustomerAuth();

  const statusOverride = isLoading
    ? "loading"
    : customer
      ? "authenticated"
      : "unauthenticated";

  const userOverride = customer ? { id: customer.id } : null;

  return (
    <RealtimeProvider
      userOverride={userOverride}
      statusOverride={statusOverride}
    >
      {children}
    </RealtimeProvider>
  );
}
