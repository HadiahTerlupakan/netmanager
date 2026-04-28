import { clientLogger } from "@/lib/client-logger";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
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

/** Manage canvasing list query state and server fetching. */
export function useCanvasingListQuery(): UseCanvasingListQueryResult {
  const [items, setItems] = useState<CanvasingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CanvasingStatusFilter>("ALL");
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<CanvasingSummary>(DEFAULT_SUMMARY);
  const latestRequestRef = useRef(0);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;

      try {
        setLoading(true);
        const params = buildFetchParams({ page, search, siteId, statusFilter });
        const response = await fetch(
          `/api/marketing/canvasing?${params.toString()}`,
          {
            signal,
          },
        );

        if (requestId !== latestRequestRef.current || signal?.aborted) {
          return;
        }

        if (response.ok) {
          const json = await response.json();
          if (requestId !== latestRequestRef.current || signal?.aborted) {
            return;
          }

          setItems(json.data || []);
          setSummary(json.summary || DEFAULT_SUMMARY);
          setTotalPages(
            Math.max(1, Math.ceil((json.total || 0) / DEFAULT_LIMIT)),
          );
          return;
        }

        const json = await response.json().catch((): null => null);
        toast.error(json?.error || "Gagal memuat data canvasing");
      } catch (error) {
        const isAbortError =
          error instanceof DOMException && error.name === "AbortError";
        if (
          isAbortError ||
          signal?.aborted ||
          requestId !== latestRequestRef.current
        ) {
          return;
        }

        clientLogger.error("Failed to fetch canvasing", error);
        toast.error("Gagal menghubungi server, coba lagi nanti");
      } finally {
        if (requestId === latestRequestRef.current && !signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [page, search, siteId, statusFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);

    return () => controller.abort();
  }, [fetchData]);

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
    await fetchData();
  }, [fetchData]);

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
