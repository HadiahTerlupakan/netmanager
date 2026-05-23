"use client";

import { useState } from "react";

import { useApi } from "@/lib/hooks/useApi";

export interface BarangOption {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  stockPerGudang?: Array<{ gudangId: string; stok: number }>;
}

interface BarangListResponse {
  barangs: BarangOption[];
}

interface UseBarangOptionsArgs {
  /** Barang dari initialData yang harus tetap muncul di list meski tidak match search. */
  persistedBarang?: BarangOption | null;
}

/**
 * Hook untuk load + search master barang via useApi (TanStack Query).
 *
 * Search dilakukan dengan update query state — TanStack Query otomatis
 * fetch ulang dengan key baru. Tidak ada manual setState dalam effect.
 *
 * Dipakai bersama oleh MasukForm, KeluarForm, TransferForm.
 */
export function useBarangOptions({
  persistedBarang,
}: UseBarangOptionsArgs = {}) {
  const [search, setSearch] = useState("");

  const url = (() => {
    const params = new URLSearchParams();
    params.append("limit", "50");
    if (search) params.append("search", search);
    return `/api/inventory/barang?${params.toString()}`;
  })();

  const { data, isLoading } = useApi<BarangListResponse>(url);
  const barangs = data?.barangs ?? [];

  const findBarang = (id: string): BarangOption | undefined => {
    const inList = barangs.find((b) => b.id === id);
    if (inList) return inList;
    if (persistedBarang?.id === id) return persistedBarang;
    return undefined;
  };

  const buildOptions = () => {
    const opts = barangs.map((b) => ({
      value: b.id,
      label: `${b.kode} - ${b.nama}`,
    }));
    if (persistedBarang && !barangs.find((b) => b.id === persistedBarang.id)) {
      opts.unshift({
        value: persistedBarang.id,
        label: `${persistedBarang.kode} - ${persistedBarang.nama}`,
      });
    }
    return opts;
  };

  return {
    barangs,
    isSearching: isLoading,
    fetchBarangs: setSearch,
    findBarang,
    buildOptions,
  };
}
