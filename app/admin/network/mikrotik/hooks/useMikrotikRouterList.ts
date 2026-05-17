import { clientLogger } from "@/lib/client-logger";
import { useEffect, useState } from "react";

import { toast } from "react-hot-toast";

import { useDebounce } from "@/hooks/useDebounce";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { useApi } from "@/lib/hooks/useApi";
import {
  MIKROTIK_PAGINATION,
  MIKROTIK_DEBOUNCE,
  MIKROTIK_API,
} from "../constants";

export type MikrotikRouterListItem = {
  id: string;
  name: string;
  ipAddress: string;
  timezone: string;
  description: string | null;
  pingStatus: string;
  userOnline: number;
  lastStatusCheck: Date | null;
};

export type PaginatedMikrotikRouters = {
  routers: MikrotikRouterListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type MikroTikUpdateData = {
  routerId?: string;
  status?: string;
};

interface SettingsPayload {
  pppConnectionMode?: "RADIUS" | "MIKROTIK_API";
}

const INITIAL_DATA: PaginatedMikrotikRouters = {
  routers: [],
  total: 0,
  page: MIKROTIK_PAGINATION.DEFAULT_PAGE,
  limit: MIKROTIK_PAGINATION.DEFAULT_LIMIT,
  totalPages: 0,
};

export function useMikrotikRouterList() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(
    search,
    MIKROTIK_DEBOUNCE.SEARCH_DELAY_MS,
  );
  const [page, setPage] = useState<number>(MIKROTIK_PAGINATION.DEFAULT_PAGE);
  const [limit, setLimit] = useState<number>(MIKROTIK_PAGINATION.DEFAULT_LIMIT);

  const queryUrl = (() => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (debouncedSearch) params.append("search", debouncedSearch);
    return `${MIKROTIK_API.BASE}?${params.toString()}`;
  })();

  const {
    data: routerData,
    isLoading: loading,
    error: routerError,
    mutate: refresh,
  } = useApi<PaginatedMikrotikRouters | { data?: PaginatedMikrotikRouters }>(
    queryUrl,
  );

  const data: PaginatedMikrotikRouters =
    routerData &&
    "data" in (routerData as object) &&
    (routerData as { data?: PaginatedMikrotikRouters }).data
      ? (routerData as { data: PaginatedMikrotikRouters }).data
      : ((routerData as PaginatedMikrotikRouters | undefined) ?? INITIAL_DATA);

  const { data: settingsData } = useApi<
    SettingsPayload | { data?: SettingsPayload }
  >(MIKROTIK_API.SETTINGS_GENERAL);
  const settingsInner: SettingsPayload =
    settingsData &&
    "data" in (settingsData as object) &&
    (settingsData as { data?: SettingsPayload }).data
      ? (settingsData as { data: SettingsPayload }).data
      : ((settingsData as SettingsPayload | undefined) ?? {});
  const pppConnectionMode = settingsInner.pppConnectionMode || "RADIUS";

  useEffect(() => {
    if (routerError) {
      clientLogger.error("Error loading routers:", routerError);
      toast.error("Gagal memuat data Router");
    }
  }, [routerError]);

  useRealtimeScope({ kind: "admin", id: "mikrotik" });

  useRealtimeEvent<MikroTikUpdateData>("mikrotik.update", () => {
    void refresh();
  });

  return {
    data,
    loading,
    search,
    setSearch,
    page,
    setPage,
    limit,
    setLimit,
    pppConnectionMode,
    refresh,
  };
}
