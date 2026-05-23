"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { StockOpnameRecord } from "@/lib/types/inventory";
import { clientLogger } from "@/lib/client-logger";

const PAGE_LIMIT = 20;

export type OpnameHistoryFilters = {
  tanggalMulai: string;
  tanggalSelesai: string;
  alasanSelisih: string;
  barangId: string;
  gudangId: string;
};

export type OpnameHistoryStats = {
  totalRecords: number;
  totalSelisihNol: number;
  akurasiPercent: number;
  totalKondisiBaik: number;
  totalKondisiRusak: number;
  totalKondisiExpire: number;
  totalHilang: number;
  totalPerluPerhatian: number;
};

export type OpnameHistoryPagination = {
  total: number;
  totalPages: number;
  currentPage: number;
  limit: number;
};

export const EMPTY_OPNAME_FILTERS: OpnameHistoryFilters = {
  tanggalMulai: "",
  tanggalSelesai: "",
  alasanSelisih: "",
  barangId: "",
  gudangId: "",
};

const EMPTY_STATS: OpnameHistoryStats = {
  totalRecords: 0,
  totalSelisihNol: 0,
  akurasiPercent: 100,
  totalKondisiBaik: 0,
  totalKondisiRusak: 0,
  totalKondisiExpire: 0,
  totalHilang: 0,
  totalPerluPerhatian: 0,
};

function buildListQueryString(
  filters: OpnameHistoryFilters,
  page: number,
  limit: number,
) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (filters.barangId) params.set("barangId", filters.barangId);
  if (filters.gudangId) params.set("gudangId", filters.gudangId);
  if (filters.tanggalMulai) params.set("tanggalMulai", filters.tanggalMulai);
  if (filters.tanggalSelesai)
    params.set("tanggalSelesai", filters.tanggalSelesai);
  if (filters.alasanSelisih) params.set("alasanSelisih", filters.alasanSelisih);
  return params.toString();
}

function buildStatsQueryString(filters: OpnameHistoryFilters) {
  const params = new URLSearchParams();
  if (filters.barangId) params.set("barangId", filters.barangId);
  if (filters.gudangId) params.set("gudangId", filters.gudangId);
  if (filters.tanggalMulai) params.set("tanggalMulai", filters.tanggalMulai);
  if (filters.tanggalSelesai)
    params.set("tanggalSelesai", filters.tanggalSelesai);
  if (filters.alasanSelisih) params.set("alasanSelisih", filters.alasanSelisih);
  return params.toString();
}

async function readJsonOrThrow(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || fallbackMessage);
  }
  const data = await response.json();
  return data.data || data;
}

async function fetchOpnameHistory(
  filters: OpnameHistoryFilters,
  page: number,
  signal: AbortSignal,
) {
  const listQuery = buildListQueryString(filters, page, PAGE_LIMIT);
  const statsQuery = buildStatsQueryString(filters);

  const [listResult, statsResult] = await Promise.all([
    fetch(`/api/inventory/opname/list?${listQuery}`, { signal }).then((res) =>
      readJsonOrThrow(res, "Gagal memuat data stock opname"),
    ),
    fetch(`/api/inventory/opname/history-stats?${statsQuery}`, {
      signal,
    }).then((res) =>
      readJsonOrThrow(res, "Gagal memuat statistik stock opname"),
    ),
  ]);

  return {
    opnameList: (listResult.opnameList || []) as StockOpnameRecord[],
    totalPages: listResult.pagination?.totalPages || 0,
    total: listResult.pagination?.total || 0,
    stats: (statsResult.stats || EMPTY_STATS) as OpnameHistoryStats,
  };
}

export function useOpnameHistory(refreshTrigger: number) {
  const [opnameList, setOpnameList] = useState<StockOpnameRecord[]>([]);
  const [stats, setStats] = useState<OpnameHistoryStats>(EMPTY_STATS);
  const [filters, setFilters] =
    useState<OpnameHistoryFilters>(EMPTY_OPNAME_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualReload, setManualReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchOpnameHistory(
          filters,
          currentPage,
          controller.signal,
        );
        if (cancelled) return;
        setOpnameList(result.opnameList);
        setTotalPages(result.totalPages);
        setTotal(result.total);
        setStats(result.stats);
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        clientLogger.error("Error fetching opname history:", err);
        setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filters, currentPage, refreshTrigger, manualReload]);

  const updateFilters = useCallback((next: Partial<OpnameHistoryFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }));
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_OPNAME_FILTERS);
    setCurrentPage(1);
  }, []);

  const refetch = useCallback(() => {
    setManualReload((value) => value + 1);
  }, []);

  const pagination = useMemo<OpnameHistoryPagination>(
    () => ({
      total,
      totalPages,
      currentPage,
      limit: PAGE_LIMIT,
    }),
    [total, totalPages, currentPage],
  );

  return {
    opnameList,
    stats,
    filters,
    pagination,
    loading,
    error,
    setCurrentPage,
    updateFilters,
    resetFilters,
    refetch,
  };
}
