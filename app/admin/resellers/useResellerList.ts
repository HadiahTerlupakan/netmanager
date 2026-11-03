import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchWithHandling, FetchError } from "@/lib/utils/fetch-wrapper";
import type { Reseller } from "./types";

export const RESELLER_LIST_URL = "/api/admin/resellers";
export const RESELLER_PAGE_SIZE = 20;

type ResellerPage = {
  readonly items: readonly Reseller[];
  readonly totalPages: number;
};

async function fetchResellerPage(page: number): Promise<ResellerPage> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(RESELLER_PAGE_SIZE),
  });
  const res = await fetchWithHandling<Reseller[]>(
    `${RESELLER_LIST_URL}?${params.toString()}`,
  );
  return {
    items: res.data ?? [],
    totalPages: res.pagination?.totalPages ?? 1,
  };
}

/**
 * Memuat satu halaman daftar reseller beserta `meta.totalPages` dari API.
 * `useApi` tidak dipakai karena fetcher-nya membuang `meta`, sehingga
 * daftar dulu terpotong di 20 baris pertama tanpa jalan ke halaman berikutnya.
 */
export function useResellerList() {
  const [page, setPage] = useState(1);
  const query = useQuery<ResellerPage, FetchError>({
    queryKey: [RESELLER_LIST_URL, page],
    queryFn: () => fetchResellerPage(page),
    placeholderData: keepPreviousData,
  });
  const totalPages = query.data?.totalPages ?? 1;

  // Halaman terakhir bisa hilang setelah baris terakhirnya dihapus; mundur
  // ke halaman terakhir yang masih ada (penyesuaian state saat render).
  // Hanya dari data halaman ini yang benar-benar berhasil dimuat: saat error
  // `data` kosong dan `totalPages` jatuh ke fallback, sehingga clamp akan
  // menyembunyikan error state. Total 0 (totalPages 0) tetap mundur ke 1.
  const lastPage = Math.max(1, totalPages);
  if (query.isSuccess && !query.isPlaceholderData && page > lastPage) {
    setPage(lastPage);
  }

  return {
    resellers: query.data?.items ?? [],
    page,
    totalPages,
    setPage,
    error: query.error ?? null,
    isLoading: query.isPending,
    refetch: query.refetch,
  };
}
