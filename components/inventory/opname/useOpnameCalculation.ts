"use client";

import { useApi } from "@/lib/hooks/useApi";

export interface OpnameCalculationItem {
  barangId: string;
  barangKode: string;
  barangNama: string;
  stokSistem: number;
  stokFisik: number;
  kondisiBaik: number;
  kondisiRusak: number;
  kondisiExpire: number;
  alasanSelisih?: string;
  lokasiPenyimpanan?: string;
  nomorRak?: string;
  nomorBox?: string;
  catatanDetail?: string;
}

export interface OpnameCalculationSummary {
  totalBarang: number;
  totalStok: number;
}

interface OpnameCalculationResponse {
  items: OpnameCalculationItem[];
  summary: OpnameCalculationSummary;
}

interface UseOpnameCalculationResult {
  items: OpnameCalculationItem[];
  summary: OpnameCalculationSummary | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Mengambil data awal opname untuk gudang terpilih.
 * Skip fetch saat `gudangId` kosong.
 */
export function useOpnameCalculation(
  gudangId: string,
): UseOpnameCalculationResult {
  const url = gudangId
    ? `/api/inventory/opname/calculate?gudangId=${encodeURIComponent(gudangId)}`
    : null;

  const { data, error, isLoading } = useApi<OpnameCalculationResponse>(url);

  return {
    items: data?.items ?? [],
    summary: data?.summary ?? null,
    isLoading,
    error: error?.message ?? null,
  };
}
