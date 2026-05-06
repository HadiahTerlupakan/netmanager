import { clientLogger } from "@/lib/client-logger";
import { useCallback, useEffect, useState } from "react";

import { toast } from "react-hot-toast";

import { useDebounce } from "@/hooks/useDebounce";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
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

const INITIAL_DATA: PaginatedMikrotikRouters = {
  routers: [],
  total: 0,
  page: MIKROTIK_PAGINATION.DEFAULT_PAGE,
  limit: MIKROTIK_PAGINATION.DEFAULT_LIMIT,
  totalPages: 0,
};

export function useMikrotikRouterList() {
  const [data, setData] = useState<PaginatedMikrotikRouters>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(
    search,
    MIKROTIK_DEBOUNCE.SEARCH_DELAY_MS,
  );
  const [page, setPage] = useState<number>(MIKROTIK_PAGINATION.DEFAULT_PAGE);
  const [limit, setLimit] = useState<number>(MIKROTIK_PAGINATION.DEFAULT_LIMIT);
  const [pppConnectionMode, setPppConnectionMode] = useState<
    "RADIUS" | "MIKROTIK_API"
  >("RADIUS");

  const fetchRouters = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }

      const [res, settingsRes] = await Promise.all([
        fetch(`${MIKROTIK_API.BASE}?${params.toString()}`),
        fetch(MIKROTIK_API.SETTINGS_GENERAL),
      ]);

      if (!res.ok) {
        throw new Error("Failed to fetch routers");
      }

      const result = await res.json();
      setData(result.data || result);

      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        const settingsData = settingsJson.data || settingsJson;
        setPppConnectionMode(settingsData.pppConnectionMode || "RADIUS");
      }
    } catch (error) {
      clientLogger.error("Error loading routers:", error);
      toast.error("Gagal memuat data Router");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    void fetchRouters();
  }, [fetchRouters]);

  useRealtimeScope({ kind: "admin", id: "mikrotik" });

  useRealtimeEvent<MikroTikUpdateData>("mikrotik.update", () => {
    void fetchRouters();
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
    refresh: fetchRouters,
  };
}
