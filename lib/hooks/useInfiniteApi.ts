/**
 * Infinite scroll fetching hook berbasis TanStack Query `useInfiniteQuery`.
 *
 * Designed untuk endpoint dengan pagination contract standar:
 * `{ data: T[], page, limit, total }`. Hook ini abstract paginasi
 * page-based dan expose flat list data + helper untuk load next page.
 *
 * Pemakaian:
 *   const { items, fetchNextPage, hasNextPage, isFetchingNextPage } =
 *     useInfiniteApi<Customer>("/api/pelanggan-ppp", { search: query });
 *
 * Lihat `docs/guides/tanstack-adoption-roadmap.md` Phase 5 untuk
 * daftar 5 list besar yang fit dengan hook ini.
 */

import {
  useInfiniteQuery,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { fetchWithHandling, type FetchError } from "@/lib/utils/fetch-wrapper";

/**
 * Bentuk response yang diharapkan dari endpoint paginated:
 *   { data: T[], page, limit, total } — sesuai apiPaginated()
 */
interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

interface UseInfiniteApiOptions {
  /** Page size. Default 20. */
  limit?: number;
  /**
   * Query string params tambahan (filter, search, dll). Akan di-merge
   * dengan `page` dan `limit` saat membuild URL.
   */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Set false untuk skip auto-fetch. */
  enabled?: boolean;
}

interface UseInfiniteApiResult<T> {
  /** Flat list dari semua page yang sudah di-fetch. */
  items: T[];
  /** Total record di server (dari page terakhir). */
  total: number;
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: FetchError | null;
  refetch: () => Promise<unknown>;
}

function buildUrl(
  baseUrl: string,
  page: number,
  limit: number,
  params: UseInfiniteApiOptions["params"],
): string {
  const usp = new URLSearchParams();
  usp.set("page", String(page));
  usp.set("limit", String(limit));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      usp.set(key, String(value));
    }
  }
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}${usp.toString()}`;
}

async function paginatedFetcher<T>(url: string): Promise<PaginatedResponse<T>> {
  const res = await fetchWithHandling<PaginatedResponse<T>>(url);
  if (!res.success) {
    const err: FetchError = {
      status: 0,
      message: res.error || "Unknown error",
      details: res.details,
    };
    throw err;
  }

  // fetchWithHandling unwrap envelope `{ data: ..., pagination }` jadi
  // res.data = list array, dan res.pagination berisi page/limit/total.
  if (Array.isArray(res.data) && res.pagination) {
    return {
      data: res.data as T[],
      page: res.pagination.page,
      limit: res.pagination.limit,
      total: res.pagination.total,
    };
  }

  // Fallback: response native `{ data: T[], page, limit, total }`
  return res.data as PaginatedResponse<T>;
}

/**
 * Fetch list paginated dengan infinite scroll. Auto-handle page key,
 * total counting, dan flat list aggregation.
 */
export function useInfiniteApi<T>(
  baseUrl: string | null,
  options: UseInfiniteApiOptions = {},
): UseInfiniteApiResult<T> {
  const limit = options.limit ?? 20;
  const params = options.params ?? {};
  const enabled = options.enabled !== false && baseUrl !== null;

  const queryKey: QueryKey = [baseUrl ?? "", limit, params];

  const query = useInfiniteQuery<
    PaginatedResponse<T>,
    FetchError,
    InfiniteData<PaginatedResponse<T>, number>,
    QueryKey,
    number
  >({
    queryKey,
    queryFn: ({ pageParam = 1 }) =>
      paginatedFetcher<T>(buildUrl(baseUrl!, pageParam, limit, params)),
    enabled,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const totalPages = Math.ceil(lastPage.total / lastPage.limit);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
  });

  const items: T[] = query.data?.pages.flatMap((p) => p.data) ?? [];
  const total = query.data?.pages.at(-1)?.total ?? 0;

  return {
    items,
    total,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage ?? false,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isPending && enabled,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: query.refetch,
  };
}
