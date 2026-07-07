"use client";

import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import type { Mitra } from "../components/types";
import type {
  WalletData,
  AdjustmentForm,
} from "../components/MitraWalletModal";

export interface UseMitraWalletActionsReturn {
  readonly showWalletModal: boolean;
  readonly setShowWalletModal: React.Dispatch<React.SetStateAction<boolean>>;
  readonly selectedWalletMitra: Mitra | null;
  readonly walletData: WalletData | null;
  readonly adjustmentForm: AdjustmentForm;
  readonly setAdjustmentForm: React.Dispatch<
    React.SetStateAction<AdjustmentForm>
  >;
  readonly adjusting: boolean;
  readonly openWalletModal: (mitra: Mitra) => Promise<void>;
  readonly handleAdjustment: () => Promise<void>;
}

export function useMitraWalletActions(
  onMutated: () => Promise<void>,
): UseMitraWalletActionsReturn {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedWalletMitra, setSelectedWalletMitra] = useState<Mitra | null>(
    null,
  );
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>({
    amount: "",
    description: "",
  });
  const [adjusting, setAdjusting] = useState(false);

  const openWalletModal = useCallback(async (mitra: Mitra) => {
    setSelectedWalletMitra(mitra);
    setWalletData(null);
    setShowWalletModal(true);

    try {
      const res = await fetch(`/api/admin/mitra/${mitra.id}/wallet`);
      const data = await res.json();
      if (res.ok && data.success) {
        setWalletData(data.data);
      } else {
        toast.error("Gagal memuat data wallet");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    }
  }, []);

  const handleAdjustment = useCallback(async () => {
    if (
      !selectedWalletMitra ||
      !adjustmentForm.amount ||
      !adjustmentForm.description
    ) {
      toast.error("Jumlah dan deskripsi harus diisi");
      return;
    }
    setAdjusting(true);
    try {
      const res = await fetch(
        `/api/admin/mitra/${selectedWalletMitra.id}/wallet`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: parseFloat(adjustmentForm.amount),
            description: adjustmentForm.description,
          }),
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Penyesuaian saldo berhasil");
        setAdjustmentForm({ amount: "", description: "" });
        await openWalletModal(selectedWalletMitra);
        await onMutated();
      } else {
        toast.error(data.error || "Gagal melakukan penyesuaian");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setAdjusting(false);
    }
  }, [selectedWalletMitra, adjustmentForm, openWalletModal, onMutated]);

  return {
    showWalletModal,
    setShowWalletModal,
    selectedWalletMitra,
    walletData,
    adjustmentForm,
    setAdjustmentForm,
    adjusting,
    openWalletModal,
    handleAdjustment,
  };
}
