/**
 * TanStack Query-based data fetching hooks untuk seluruh aplikasi.
 *
 * Pattern penggantian dari `useEffect + fetch + useState`. Lihat
 * `docs/standards/data-fetching.md` untuk panduan migrasi.
 *
 * `useApi` di-design sebagai abstraction tipis di atas `useQuery` dengan
 * API ergonomis untuk pola fetch GET sederhana, plus expose `mutate`
 * (analog dengan SWR) untuk migrasi yang minimal disruption.
 */

import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  fetchWithHandling,
  type ApiResponse,
  type FetchError,
} from "@/lib/utils/fetch-wrapper";

/**
 * Default fetcher: pakai `fetchWithHandling` agar error format konsisten
 * dengan seluruh codebase (rate-limit handling, parsed body, dst).
 */
export const apiFetcher = async <T>(url: string): Promise<T> => {
  const res = await fetchWithHandling<T>(url);
  if (!res.success) {
    const err: FetchError = {
      status: 0,
      message: res.error || "Unknown error",
      details: res.details,
    };
    throw err;
  }
  return (res.data ?? (res as unknown as T)) as T;
};

type MutateUpdater<T> =
  | T
  | undefined
  | ((prev: T | undefined) => T | undefined);
type MutateOptions = { revalidate?: boolean };

interface UseApiResult<T> {
  data: T | undefined;
  error: FetchError | null;
  isLoading: boolean;
  /**
   * Re-fetch atau update cache untuk key ini.
   * - `mutate()` → invalidate & re-fetch
   * - `mutate(value, { revalidate: false })` → set cache tanpa fetch
   * - `mutate(updater, { revalidate: false })` → set via updater fn
   */
  mutate: (
    updater?: MutateUpdater<T>,
    options?: MutateOptions,
  ) => Promise<T | undefined>;
}

interface UseApiOptions<T> {
  /** Callback dipanggil saat error pertama kali muncul (untuk toast, dll). */
  onError?: (error: FetchError) => void;
  /** Callback dipanggil saat data berubah (mis. pre-select item pertama). */
  onSuccess?: (data: T) => void;
  /** Refresh interval (ms). Set 0 untuk disable polling. */
  refreshInterval?: number;
  /** Override stale time (ms). Default: query client default. */
  staleTime?: number;
  /** Tambahan opsi useQuery (advanced). */
  queryOptions?: Omit<
    UseQueryOptions<T, FetchError, T, readonly [string]>,
    "queryKey" | "queryFn" | "enabled" | "refetchInterval" | "staleTime"
  >;
}

/**
 * Hook umum untuk GET request. Ganti pola lama:
 *   const [data, setData] = useState();
 *   useEffect(() => { fetch(url).then(setData) }, [])
 *
 * dengan:
 *   const { data, isLoading, error, mutate } = useApi<T>(url);
 *
 * Gunakan `null` sebagai key untuk skip fetch (conditional fetching).
 */
export function useApi<T>(
  key: string | null,
  options?: UseApiOptions<T>,
): UseApiResult<T> {
  const queryClient = useQueryClient();
  const enabled = key !== null;
  const query = useQuery<T, FetchError, T, readonly [string]>({
    queryKey: [key ?? ""] as const,
    queryFn: () => apiFetcher<T>(key!),
    enabled,
    refetchInterval: options?.refreshInterval,
    staleTime: options?.staleTime,
    ...options?.queryOptions,
  });

  // Side-effect callbacks (dihapus dari TanStack v5, replace via useEffect)
  useEffect(() => {
    if (query.error && options?.onError) {
      options.onError(query.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.error]);

  useEffect(() => {
    if (query.data && options?.onSuccess) {
      options.onSuccess(query.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const mutate: UseApiResult<T>["mutate"] = async (updater, opts) => {
    if (!key) return undefined;
    const queryKey = [key] as const;

    // Update cache dengan value/updater jika provided
    if (updater !== undefined) {
      const next = queryClient.setQueryData<T>(queryKey, (prev) =>
        typeof updater === "function"
          ? (updater as (p: T | undefined) => T | undefined)(prev)
          : updater,
      );
      if (opts?.revalidate === false) {
        return next;
      }
    }

    // Default: invalidate untuk re-fetch
    await queryClient.invalidateQueries({ queryKey });
    return queryClient.getQueryData<T>(queryKey);
  };

  return {
    data: query.data,
    error: query.error ?? null,
    isLoading: query.isPending && enabled,
    mutate,
  };
}

/**
 * Trigger revalidation manual untuk key tertentu (mis. setelah mutation
 * dari komponen lain). Pemakaian: `const revalidate = useRevalidate();
 * revalidate("/api/users");`
 */
export function useRevalidate() {
  const queryClient = useQueryClient();
  return (key: string) => queryClient.invalidateQueries({ queryKey: [key] });
}

export type { ApiResponse, FetchError };
