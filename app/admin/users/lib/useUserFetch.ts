"use client";

import { useMemo } from "react";
import { useApi } from "@/lib/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { USER_LIST_CONSTANTS } from "./constants";
import type { User, UserListResponse } from "./types";

interface UseUserFetchOptions {
  page: number;
  searchTerm: string;
  statusFilter: "all" | "active" | "inactive";
  tenantIdFilter?: string | null;
}

interface UseUserFetchResult {
  users: User[];
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  loading: boolean;
  error: string | null;
  mutate: () => Promise<unknown>;
  debouncedSearchTerm: string;
}

/**
 * Fetch daftar user dengan filter & pagination via TanStack Query.
 * Auto-debounce search, dedup paralel request, abort otomatis saat key berubah.
 */
export function useUserFetch({
  page,
  searchTerm,
  statusFilter,
  tenantIdFilter,
}: UseUserFetchOptions): UseUserFetchResult {
  const debouncedSearchTerm = useDebounce(
    searchTerm,
    USER_LIST_CONSTANTS.SEARCH_DEBOUNCE_MS,
  );

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", USER_LIST_CONSTANTS.ITEMS_PER_PAGE.toString());
    if (tenantIdFilter) params.append("tenantId", tenantIdFilter);
    if (debouncedSearchTerm) params.append("search", debouncedSearchTerm);
    if (statusFilter !== "all") params.append("status", statusFilter);
    return `/api/admin/users?${params.toString()}`;
  }, [page, tenantIdFilter, debouncedSearchTerm, statusFilter]);

  const { data, error, isLoading, mutate } = useApi<UserListResponse>(endpoint);

  const payload = data ?? {
    users: [],
    meta: { total: 0, active: 0, inactive: 0 },
  };

  return {
    users: payload.users,
    totalUsers: payload.meta.total,
    activeUsers: payload.meta.active,
    inactiveUsers: payload.meta.inactive,
    loading: isLoading,
    error: error ? error.message : null,
    mutate,
    debouncedSearchTerm,
  };
}
