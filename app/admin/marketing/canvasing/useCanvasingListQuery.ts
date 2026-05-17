import { clientLogger } from "@/lib/client-logger";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  CanvasingItem,
  CanvasingStatusFilter,
  CanvasingSummary,
  FetchQueryState,
} from "./CanvasingListTypes";
import { DEFAULT_SUMMARY } from "./CanvasingListTypes";

const DEFAULT_LIMIT = 10;

interface UseCanvasingListQueryResult {
  items: CanvasingItem[];
  loading: boolean;
  search: string;
  statusFilter: CanvasingStatusFilter;
  siteId?: string;
  page: number;
  totalPages: number;
  summary: CanvasingSummary;
  setPage: (page: number) => void;
  updateSearch: (value: string) => void;
  updateStatusFilter: (value: CanvasingStatusFilter) => void;
  updateSiteId: (value?: string) => void;
  refetch: () => Promise<void>;
}

interface CanvasingListResponse {
  data?: CanvasingItem[];
  summary?: CanvasingSummary;
  total?: number;
  error?: string;
}

function buildFetchParams(query: FetchQueryState) {
  const params = new URLSearchParams();
  const trimmedSearch = query.search.trim();

  if (query.siteId) params.append("siteId", query.siteId);
  if (query.statusFilter !== "ALL") params.append("status", query.statusFilter);
  if (trimmedSearch) params.append("search", trimmedSearch);
  params.append("page", query.page.toString());
  params.append("limit", DEFAULT_LIMIT.toString());

  return params;
}

async function fetchCanvasingList(
  url: string,
  signal: AbortSignal,
): Promise<CanvasingListResponse> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const json = (await response
      .json()
      .catch((): null => null)) as CanvasingListResponse | null;
    throw new Error(json?.error || "Gagal memuat data canvasing");
  }
  return (await response.json()) as CanvasingListResponse;
}

/**
 * Manage canvasing list query state via TanStack Query.
 *
 * Race conditions di-handle otomatis: queryKey berubah → query lama
 * di-cancel via signal, query baru jadi sumber kebenaran. Tidak butuh
 * manual `latestRequestRef`.
 */
export function useCanvasingListQuery(): UseCanvasingListQueryResult {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CanvasingStatusFilter>("ALL");
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const params = buildFetchParams({ page, search, siteId, statusFilter });
  const url = `/api/marketing/canvasing?${params.toString()}`;

  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["canvasing-list", url] as const, [url]);
  const { data, error, isPending } = useQuery<CanvasingListResponse, Error>({
    queryKey,
    queryFn: ({ signal }) => fetchCanvasingList(url, signal),
    // Pertahankan data lama saat queryKey berubah agar UI tidak unmount
    // (filter change tidak flash ke loader). Penting untuk UX dan untuk
    // konsistensi test yang assume button tetap ada saat filter berubah.
    placeholderData: keepPreviousData,
  });

  // Side-effect: toast on error (di luar render via useEffect — tidak setState)
  useEffect(() => {
    if (error) {
      const isAbortError =
        error instanceof DOMException && error.name === "AbortError";
      if (isAbortError) return;
      clientLogger.error("Failed to fetch canvasing", error);
      toast.error(error.message || "Gagal menghubungi server, coba lagi nanti");
    }
  }, [error]);

  const items = data?.data ?? [];
  const summary = data?.summary ?? DEFAULT_SUMMARY;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / DEFAULT_LIMIT));
  // `loading` true hanya saat fetch pertama (belum ada data di cache).
  // Refetch (filter change/page change) jangan unmount UI — tampilkan
  // data lama sambil revalidate.
  const loading = isPending;

  const updateSearch = useCallback((value: string) => {
    setPage(1);
    setSearch(value);
  }, []);

  const updateStatusFilter = useCallback((value: CanvasingStatusFilter) => {
    setPage(1);
    setStatusFilter(value);
  }, []);

  const updateSiteId = useCallback((value?: string) => {
    setPage(1);
    setSiteId(value);
  }, []);

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    items,
    loading,
    search,
    statusFilter,
    siteId,
    page,
    totalPages,
    summary,
    setPage,
    updateSearch,
    updateStatusFilter,
    updateSiteId,
    refetch,
  };
}
