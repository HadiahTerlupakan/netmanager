"use client";

import { useMemo, useState } from "react";

import { useApi } from "@/lib/hooks/useApi";

export interface Transfer {
  id: string;
  kodeTransfer: string;
  tanggal: string;
  barangId: string;
  jumlah: number;
  kondisi: "BARU" | "BEKAS" | "RUSAK";
  keterangan?: string;
  fotoBukti?: string[];
  barang?: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
  };
  dariGudang?: {
    kode: string;
    nama: string;
    lokasi?: string;
  };
  keGudang?: {
    kode: string;
    nama: string;
    lokasi?: string;
  };
  createdBy?: {
    name: string;
  };
  keluar?: {
    tanggal: string;
    keterangan: string;
  };
  masuk?: {
    tanggal: string;
    keterangan: string;
  };
}

interface TransferListResponse {
  transferList?: Transfer[];
  transfers?: Transfer[];
  pagination?: {
    total: number;
    totalPages: number;
  };
  meta?: {
    total: number;
    totalPages: number;
  };
}

const PAGE_LIMIT = 20;

export function useTransferList() {
  const [page, setPage] = useState(1);

  const url = useMemo(
    () => `/api/inventory/transfer?page=${page}&limit=${PAGE_LIMIT}`,
    [page],
  );

  const { data, error, isLoading, mutate } = useApi<TransferListResponse>(url);

  const transfers: Transfer[] = data?.transferList ?? data?.transfers ?? [];

  const pagination = {
    page,
    limit: PAGE_LIMIT,
    total: data?.pagination?.total ?? data?.meta?.total ?? 0,
    totalPages: data?.pagination?.totalPages ?? data?.meta?.totalPages ?? 0,
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1) return;
    if (pagination.totalPages > 0 && newPage > pagination.totalPages) return;
    setPage(newPage);
  };

  return {
    transfers,
    pagination,
    loading: isLoading,
    error: error?.message ?? "",
    refresh: () => mutate(),
    refreshFirstPage: () => {
      setPage(1);
      void mutate();
    },
    handlePageChange,
  };
}
