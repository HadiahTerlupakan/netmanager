"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { useRealtime } from "@/lib/realtime/RealtimeContext";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

import { createRadiusDashboardApi } from "@/app/admin/network/radius/lib/radiusDashboardApi";
import {
  applyRealtimeSessionsUpdate,
  applyRealtimeStatsUpdate,
  createInitialRadiusDashboardState,
  refreshRadiusDashboardState,
} from "@/app/admin/network/radius/lib/radiusDashboardState";
import { useRadiusHistoryState } from "@/app/admin/network/radius/lib/radiusHistoryState";
import { useRadiusResetState } from "@/app/admin/network/radius/lib/radiusResetState";

export type { RadiusSessionHistoryData } from "@/app/admin/network/radius/lib/radiusDashboardApi";

/**
 * Compose RADIUS dashboard state, history flow, reset flow, and realtime updates.
 */
export function useRadiusDashboardData() {
  const api = useMemo(() => createRadiusDashboardApi(), []);
  const { data: session } = useSession();
  const { isConnected } = useRealtime();
  const [dashboardState, setDashboardState] = useState(
    createInitialRadiusDashboardState(),
  );
  const dashboardStateRef = useRef(dashboardState);
  const dashboardVersionRef = useRef(0);

  useEffect(() => {
    dashboardStateRef.current = dashboardState;
  }, [dashboardState]);

  const commitDashboardState = useCallback(
    (
      update: (previousState: typeof dashboardState) => typeof dashboardState,
      shouldTrackVersion = true,
    ) => {
      setDashboardState((previousState) => {
        const nextState = update(previousState);
        dashboardStateRef.current = nextState;

        if (shouldTrackVersion) {
          dashboardVersionRef.current += 1;
        }

        return nextState;
      });
    },
    [],
  );

  const refreshDashboard = useCallback(async () => {
    const requestVersion = dashboardVersionRef.current;

    commitDashboardState(
      (previousState) => ({
        ...previousState,
        refreshing: true,
        dashboardError: null,
      }),
      false,
    );

    const nextState = await refreshRadiusDashboardState(
      dashboardStateRef.current,
      api,
    );

    if (dashboardVersionRef.current !== requestVersion) {
      commitDashboardState(
        (previousState) => ({
          ...previousState,
          loading: false,
          refreshing: false,
        }),
        false,
      );
      return;
    }

    commitDashboardState(() => nextState);
  }, [api, commitDashboardState]);

  const historyState = useRadiusHistoryState({ fetchHistory: api.getHistory });
  const resetState = useRadiusResetState({
    resetConnection: api.resetConnection,
    refreshDashboard,
  });

  useEffect(() => {
    void refreshDashboard();
  }, [refreshDashboard]);

  useRealtimeScope(
    session?.user?.tenantId
      ? { kind: "admin", id: `radius:${session.user.tenantId}` }
      : null,
  );

  const handleStatsUpdate = useCallback(
    (payload: Parameters<typeof applyRealtimeStatsUpdate>[1]) => {
      commitDashboardState((previousState) =>
        applyRealtimeStatsUpdate(previousState, payload),
      );
    },
    [commitDashboardState],
  );

  const handleSessionsUpdate = useCallback(
    (payload: Parameters<typeof applyRealtimeSessionsUpdate>[1]) => {
      commitDashboardState((previousState) =>
        applyRealtimeSessionsUpdate(previousState, payload),
      );
    },
    [commitDashboardState],
  );

  useRealtimeEvent("radius.stats", handleStatsUpdate);
  useRealtimeEvent("radius.sessions", handleSessionsUpdate);

  const setDashboardError = useCallback((value: string | null) => {
    setDashboardState((previousState) => {
      const nextState = {
        ...previousState,
        dashboardError: value,
      };
      dashboardStateRef.current = nextState;
      return nextState;
    });
  }, []);

  return {
    stats: dashboardState.stats,
    sessions: dashboardState.sessions,
    loading: dashboardState.loading,
    refreshing: dashboardState.refreshing,
    dashboardError: dashboardState.dashboardError,
    setDashboardError,
    isConnected,
    resettingUsername: resetState.resettingUsername,
    viewingHistoryUsername: historyState.viewingHistoryUsername,
    historyModalOpen: historyState.historyModalOpen,
    historyLoading: historyState.historyLoading,
    historyError: historyState.historyError,
    historyData: historyState.historyData,
    historyStartDate: historyState.historyStartDate,
    historyEndDate: historyState.historyEndDate,
    setHistoryStartDate: historyState.setHistoryStartDate,
    setHistoryEndDate: historyState.setHistoryEndDate,
    actionError: resetState.actionError,
    actionSuccess: resetState.actionSuccess,
    setActionError: resetState.setActionError,
    setActionSuccess: resetState.setActionSuccess,
    viewHistory: historyState.viewHistory,
    changeHistoryPage: historyState.changeHistoryPage,
    applyHistoryFilter: historyState.applyHistoryFilter,
    resetHistoryFilter: historyState.resetHistoryFilter,
    closeHistoryModal: historyState.closeHistoryModal,
    resetConnection: resetState.resetConnection,
    refresh: refreshDashboard,
  };
}
