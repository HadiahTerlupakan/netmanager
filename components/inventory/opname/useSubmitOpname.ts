"use client";

import { useState } from "react";
import { fetchWithHandling } from "@/lib/utils/fetch-wrapper";
import type { OpnameCalculationItem } from "./useOpnameCalculation";

interface SubmitOpnameInput {
  gudangId: string;
  items: OpnameCalculationItem[];
}

interface OpnameBatchResponse {
  message: string;
  totalItems: number;
}

interface UseSubmitOpnameResult {
  submit: (input: SubmitOpnameInput) => Promise<OpnameBatchResponse>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Kirim seluruh item opname dalam satu transaksi atomic ke
 * `POST /api/inventory/opname/batch`. Memastikan envelope ter-unwrap
 * via `fetchWithHandling`.
 */
export function useSubmitOpname(): UseSubmitOpnameResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (
    input: SubmitOpnameInput,
  ): Promise<OpnameBatchResponse> => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        gudangId: input.gudangId,
        items: input.items.map((item) => buildOpnameBatchItem(item)),
      };

      const res = await fetchWithHandling<OpnameBatchResponse>(
        "/api/inventory/opname/batch",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      if (!res.success || !res.data) {
        throw new Error(res.error || "Gagal mencatat stock opname");
      }

      return res.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submit,
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}

function buildOpnameBatchItem(item: OpnameCalculationItem) {
  const alasanText = OPNAME_REASON_LABEL[item.alasanSelisih ?? ""] ?? "";
  const today = new Date().toLocaleDateString("id-ID");
  const keterangan = item.alasanSelisih
    ? `Stock Opname ${today} - ${alasanText}${item.catatanDetail ? ": " + item.catatanDetail : ""}`
    : `Stock Opname Otomatis ${today} - ${item.catatanDetail || "Berdasarkan transaksi aktual"}`;

  return {
    barangId: item.barangId,
    stokFisik: item.stokFisik,
    kondisiBaik: item.kondisiBaik,
    kondisiRusak: item.kondisiRusak,
    kondisiExpire: item.kondisiExpire,
    keterangan,
    alasanSelisih: item.alasanSelisih || undefined,
    lokasiPenyimpanan: item.lokasiPenyimpanan || undefined,
    nomorRak: item.nomorRak || undefined,
    nomorBox: item.nomorBox || undefined,
    catatanDetail: item.catatanDetail || undefined,
  };
}

const OPNAME_REASON_LABEL: Record<string, string> = {
  hilang: "Hilang / Kehilangan",
  rusak: "Rusak / Tidak Layak",
  revisi: "Revisi Stok / Koreksi Data",
  salah_input: "Kesalahan Input Sebelumnya",
  terpakai: "Terpakai Tidak Tercatat",
  expired: "Kadaluarsa / Expire",
  lebih: "Stok Lebih / Ditemukan",
  lainnya: "Lainnya",
};
