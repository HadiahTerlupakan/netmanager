import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { useRealtime } from "@/lib/realtime/RealtimeContext";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

export interface RadiusDashboardStats {
  totalUsers: number;
  onlineUsers: number;
  offlineUsers: number;
  totalTrafficToday: {
    download: string;
    upload: string;
    downloadGB: number;
    uploadGB: number;
  };
  lastSyncTime: string;
  lastSyncStats: {
    created: number;
    updated: number;
    deleted: number;
  };
}

export interface RadiusSession {
  radAcctId: string;
  username: string | null;
  nasIpAddress: string;
  framedIpAddress: string | null;
  acctStartTime: string | null;
  uptimeHours: number;
  downloadMB: number;
  uploadMB: number;
  isOnline: boolean;
}

export interface RadiusSessionHistoryData {
  username: string;
  summary: {
    totalSessions: number;
    activeSessions: number;
    totalSessionTime: string;
    totalSessionHours: number;
    totalInputOctets: string;
    totalOutputOctets: string;
    totalOctets: string;
    totalInputMB: number;
    totalOutputMB: number;
    totalMB: number;
    totalInputGB: number;
    totalOutputGB: number;
    totalGB: number;
  };
  sessions: Array<{
    radAcctId: string;
    username: string | null;
    nasIpAddress: string;
    framedIpAddress: string | null;
    acctStartTime: string | null;
    acctStopTime: string | null;
    acctSessionTime: string;
    acctSessionHours: number;
    acctInputOctets: string;
    acctOutputOctets: string;
    totalOctets: string;
    uploadMB: number;
    downloadMB: number;
    totalMB: number;
    uploadGB: number;
    downloadGB: number;
    totalGB: number;
    isOnline: boolean;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  period?: {
    startDate?: string | null;
    endDate?: string | null;
  };
}

export function useRadiusDashboardData() {
  const [resettingUsername, setResettingUsername] = useState<string | null>(
    null,
  );
  const [viewingHistoryUsername, setViewingHistoryUsername] = useState<
    string | null
  >(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyData, setHistoryData] =
    useState<RadiusSessionHistoryData | null>(null);
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const { isConnected } = useRealtime();
  const { data: session } = useSession();
  const [stats, setStats] = useState<RadiusDashboardStats | null>(null);
  const [sessions, setSessions] = useState<RadiusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const statsRes = await fetch("/api/admin/radius/dashboard/stats");
      const statsJson = await statsRes.json();
      const statsData = statsJson?.data ?? statsJson;
      setStats(statsData);

      const sessionsRes = await fetch(
        "/api/admin/radius/dashboard/recent-sessions?status=active&limit=50",
      );
      const sessionsJson = await sessionsRes.json();
      const sessionsData = sessionsJson?.data ?? sessionsJson;
      setSessions(sessionsData?.sessions || []);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useRealtimeScope(
    session?.user?.tenantId
      ? { kind: "admin", id: `radius:${session.user.tenantId}` }
      : null,
  );

  const handleStatsUpdate = useCallback((newStats: RadiusDashboardStats) => {
    setStats(newStats);
  }, []);

  const handleSessionsUpdate = useCallback(
    (data: { sessions: RadiusSession[]; total: number }) => {
      if (data && data.sessions) {
        setSessions(data.sessions);
      }
    },
    [],
  );

  const fetchUserHistory = useCallback(
    async (
      username: string,
      page = 1,
      startDateParam?: string,
      endDateParam?: string,
    ) => {
      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "20",
        });

        if (startDateParam) params.set("startDate", startDateParam);
        if (endDateParam) params.set("endDate", endDateParam);

        const response = await fetch(
          `/api/admin/radius/sessions/${encodeURIComponent(username)}/history?${params.toString()}`,
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error || payload?.message || "Gagal memuat history sesi",
          );
        }

        const data = payload?.data ?? payload;
        setHistoryData(data);
        setViewingHistoryUsername(username);
        setHistoryModalOpen(true);
      } catch (error) {
        setHistoryError(
          error instanceof Error ? error.message : "Gagal memuat history sesi",
        );
        setHistoryModalOpen(true);
      } finally {
        setHistoryLoading(false);
      }
    },
    [],
  );

  const viewHistory = useCallback(
    async (username: string) => {
      if (!username) return;
      await fetchUserHistory(username, 1);
    },
    [fetchUserHistory],
  );

  const changeHistoryPage = useCallback(
    async (page: number) => {
      if (!viewingHistoryUsername || page < 1) return;
      await fetchUserHistory(
        viewingHistoryUsername,
        page,
        historyStartDate || undefined,
        historyEndDate || undefined,
      );
    },
    [
      fetchUserHistory,
      historyEndDate,
      historyStartDate,
      viewingHistoryUsername,
    ],
  );

  const applyHistoryFilter = useCallback(async () => {
    if (!viewingHistoryUsername) return;
    await fetchUserHistory(
      viewingHistoryUsername,
      1,
      historyStartDate || undefined,
      historyEndDate || undefined,
    );
  }, [
    fetchUserHistory,
    historyEndDate,
    historyStartDate,
    viewingHistoryUsername,
  ]);

  const resetHistoryFilter = useCallback(async () => {
    setHistoryStartDate("");
    setHistoryEndDate("");
    if (!viewingHistoryUsername) return;
    await fetchUserHistory(viewingHistoryUsername, 1);
  }, [fetchUserHistory, viewingHistoryUsername]);

  const closeHistoryModal = useCallback(() => {
    setHistoryModalOpen(false);
    setHistoryError(null);
    setViewingHistoryUsername(null);
  }, []);

  const resetConnection = useCallback(
    async (username: string) => {
      if (!username) return;
      setActionError(null);
      setActionSuccess(null);
      setResettingUsername(username);

      try {
        const response = await fetch("/api/admin/radius/sessions/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });

        const payload = await response.json();
        const data = payload?.data ?? payload;

        if (!response.ok) {
          throw new Error(
            payload?.error || payload?.message || "Gagal reset koneksi",
          );
        }

        const disconnected = Number(data?.disconnected ?? 0);
        setActionSuccess(
          `Reset koneksi ${username} berhasil (${disconnected} sesi diputus)`,
        );
        await fetchData(true);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Gagal reset koneksi",
        );
      } finally {
        setResettingUsername(null);
      }
    },
    [fetchData],
  );

  useRealtimeEvent("radius.stats", handleStatsUpdate);
  useRealtimeEvent("radius.sessions", handleSessionsUpdate);

  return {
    stats,
    sessions,
    loading,
    refreshing,
    isConnected,
    resettingUsername,
    viewingHistoryUsername,
    historyModalOpen,
    historyLoading,
    historyError,
    historyData,
    historyStartDate,
    historyEndDate,
    setHistoryStartDate,
    setHistoryEndDate,
    actionError,
    actionSuccess,
    setActionError,
    setActionSuccess,
    viewHistory,
    changeHistoryPage,
    applyHistoryFilter,
    resetHistoryFilter,
    closeHistoryModal,
    resetConnection,
    refresh: fetchData,
  };
}
