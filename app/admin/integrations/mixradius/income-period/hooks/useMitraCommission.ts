"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { clientLogger } from "@/lib/client-logger";
import { formatCurrency } from "@/lib/utils";

interface UseMitraCommissionParams {
  startDate: string;
  setPayouts: React.Dispatch<
    React.SetStateAction<
      Array<{ referenceId?: string; amount: string | number }>
    >
  >;
}

/**
 * Hook untuk mengelola sinkronisasi komisi penjualan mitra.
 */
export function useMitraCommission({
  startDate,
  setPayouts,
}: UseMitraCommissionParams) {
  const [syncingMitra, setSyncingMitra] = useState<string | null>(null);

  const handleSyncCommission = async (
    mitra: { id: string; name: string },
    amount: number,
    activeCount: number,
  ) => {
    if (amount <= 0) {
      toast.error("Tidak ada komisi yang perlu disinkronisasi");
      return;
    }

    const periodKey = startDate.substring(0, 7);
    const timestamp = new Date().getTime();
    const referenceId = `PAYOUT-FEE-${periodKey}-${mitra.id}-${timestamp}`;

    setSyncingMitra(mitra.id);
    try {
      const res = await fetch("/api/admin/mitra/sync-commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mitraId: mitra.id,
          amount,
          referenceId,
          description: `Sync Komisi Pelanggan Berbayar Periode ${periodKey} (+${activeCount} Pelanggan)`,
        }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(
          `Berhasil sinkronisasi komisi ${mitra.name} sebesar ${formatCurrency(amount)}`,
        );
        // Refresh payouts
        const payoutRes = await fetch(
          "/api/admin/mitra/transactions?type=EARNING&limit=1000",
        );
        if (payoutRes.ok) {
          const payoutData = await payoutRes.json();
          if (
            payoutData.success &&
            Array.isArray(payoutData.data?.transactions)
          ) {
            setPayouts(payoutData.data.transactions);
          }
        }
      } else {
        toast.error(result.message || "Gagal sinkronisasi komisi");
      }
    } catch (err) {
      clientLogger.error("Gagal sinkronisasi komisi mitra", err);
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setSyncingMitra(null);
    }
  };

  return {
    syncingMitra,
    handleSyncCommission,
  };
}
