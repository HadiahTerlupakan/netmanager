"use client";

import { useApi } from "@/lib/hooks/useApi";

export interface GudangOption {
  id: string;
  kode: string;
  nama: string;
  lokasi?: string;
}

interface GudangResponse {
  gudangs?: GudangOption[];
}

/**
 * Hook untuk load list gudang. Cached lewat useApi (TanStack Query).
 * Dipakai oleh MasukForm, KeluarForm, TransferForm.
 */
export function useGudangOptions() {
  const { data, isLoading, error } = useApi<GudangResponse>(
    "/api/inventory/gudang",
  );
  return {
    gudangs: data?.gudangs ?? [],
    loading: isLoading,
    error: error?.message ?? "",
  };
}
