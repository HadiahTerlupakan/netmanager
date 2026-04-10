import { useCallback, useEffect, useState } from "react";

import { toast } from "react-hot-toast";

import { useDebounce } from "@/hooks/useDebounce";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

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
  page: 1,
  limit: 10,
  totalPages: 0,
};

export function useMikrotikRouterList() {
  const [data, setData] = useState<PaginatedMikrotikRouters>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
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
        fetch(`/api/mikrotik-routers?${params.toString()}`),
        fetch("/api/settings/general"),
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
      console.error("Error loading routers:", error);
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
