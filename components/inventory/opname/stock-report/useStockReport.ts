"use client";

import { useEffect, useState } from "react";

import { clientLogger } from "@/lib/client-logger";

export type StockItem = {
  barangId: string;
  barangKode: string;
  barangNama: string;
  barangSatuan: string;
  stokTotal: number;
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
  totalHilang: number;
};

export type GudangStock = {
  gudangId: string;
  gudangKode: string;
  gudangNama: string;
  gudangLokasi: string | null;
  totalBarang: number;
  totalStok: number;
  totalStokBaru: number;
  totalStokBekas: number;
  totalStokRusak: number;
  totalHilang: number;
  items: StockItem[];
};

export type GudangOption = {
  id: string;
  kode: string;
  nama: string;
};

async function readJsonOrThrow(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || fallbackMessage);
  }
  const data = await response.json();
  return data.data || data;
}

async function fetchGudangOptions(
  signal: AbortSignal,
): Promise<GudangOption[]> {
  const response = await fetch("/api/inventory/gudang?view=all", { signal });
  const json = await readJsonOrThrow(response, "Gagal memuat daftar gudang");
  return json.gudangs ?? [];
}

async function fetchGudangReport(
  gudangId: string,
  signal: AbortSignal,
): Promise<GudangStock | null> {
  const response = await fetch(
    `/api/inventory/opname/report?gudangId=${gudangId}`,
    { signal },
  );
  const json = await readJsonOrThrow(response, "Gagal memuat laporan stok");
  const list: GudangStock[] = json.gudangList ?? [];
  return list[0] ?? null;
}

export function useStockReport() {
  const [gudangOptions, setGudangOptions] = useState<GudangOption[]>([]);
  const [selectedGudangId, setSelectedGudangId] = useState("");
  const [gudangData, setGudangData] = useState<GudangStock | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setLoadingList(true);
      try {
        const options = await fetchGudangOptions(controller.signal);
        if (!cancelled) setGudangOptions(options);
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        clientLogger.error("Error fetching gudang list:", err);
        setError(
          err instanceof Error ? err.message : "Gagal memuat daftar gudang",
        );
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!selectedGudangId) return;

    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setLoadingReport(true);
      setError("");
      try {
        const data = await fetchGudangReport(
          selectedGudangId,
          controller.signal,
        );
        if (!cancelled) setGudangData(data);
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        clientLogger.error("Error fetching stock report:", err);
        setError(
          err instanceof Error ? err.message : "Gagal memuat laporan stok",
        );
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedGudangId, refreshToken]);

  const effectiveGudangData = selectedGudangId ? gudangData : null;

  return {
    gudangOptions,
    selectedGudangId,
    setSelectedGudangId,
    gudangData: effectiveGudangData,
    loading: loadingList || loadingReport,
    error,
    refresh: () => setRefreshToken((value) => value + 1),
  };
}
