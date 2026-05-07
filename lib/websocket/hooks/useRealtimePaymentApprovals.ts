"use client";
import { clientLogger } from "@/lib/client-logger";

import { useState, useEffect, useCallback } from "react";
import { useRealtime } from "@/lib/realtime/RealtimeContext";
import { useSession } from "next-auth/react";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";

export interface PendingPayment {
  id: string;
  amount: number;
  method: string;
  status: string;
  receiptUrl: string;
  createdAt: string;
  customerName: string;
  invoice: {
    id: string;
    invoiceNumber: string;
    customerId: string;
    totalAmount: number;
  } | null;
}

interface UseRealtimePaymentApprovalsReturn {
  payments: PendingPayment[];
  loading: boolean;
  isConnected: boolean;
  refresh: () => Promise<void>;
}

export function useRealtimePaymentApprovals(): UseRealtimePaymentApprovalsReturn {
  const { data: session } = useSession();
  const { isConnected } = useRealtime();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingPayments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/payments/pending-manual");
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Gagal mengambil pembayaran manual: ${res.status} ${body}`,
        );
      }
      const json = await res.json();
      if (json.success) {
        setPayments(json.data);
      }
    } catch (error) {
      clientLogger.error("Failed to fetch pending payments:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchPendingPayments();
  }, [fetchPendingPayments]);

  const handlePaymentNew = useCallback(
    (payload: unknown) => {
      clientLogger.info("[WS] New payment pending:", payload);
      // Refetch to get consistent latest data
      fetchPendingPayments();

      // Play notification sound
      try {
        const audio = new Audio("/sounds/notification.mp3");
        audio.play().catch((e) => clientLogger.error("Audio play failed:", e));
      } catch (e) {
        clientLogger.error("Audio initialization failed:", e);
      }
    },
    [fetchPendingPayments],
  );

  // Only subscribe if user can access admin panel
  const canAccessAdminPanel = Boolean(
    (session?.user as { accessAdminPanel?: boolean })?.accessAdminPanel,
  );

  useRealtimeEvent("payment.pending.new", (payload: unknown) => {
    if (canAccessAdminPanel) {
      handlePaymentNew(payload);
    }
  });

  return {
    payments,
    loading,
    isConnected, // Return connection status from context
    refresh: fetchPendingPayments,
  };
}
