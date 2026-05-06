import type {
  RadiusDashboardStatsViewModel,
  RadiusRecentSessionViewModel,
} from "@/modules/network";

import type { RadiusDashboardApi } from "./radiusDashboardApi";
import { getRadiusErrorMessage } from "./radiusErrorUtils";
import { RADIUS_MESSAGES } from "../constants";

export interface RadiusDashboardState {
  stats: RadiusDashboardStatsViewModel | null;
  sessions: RadiusRecentSessionViewModel[];
  loading: boolean;
  refreshing: boolean;
  dashboardError: string | null;
}

export function createInitialRadiusDashboardState(): RadiusDashboardState {
  return {
    stats: null,
    sessions: [],
    loading: true,
    refreshing: false,
    dashboardError: null,
  };
}

function setDashboardLoadingState(
  previousState: RadiusDashboardState,
): RadiusDashboardState {
  return {
    ...previousState,
    refreshing: true,
    dashboardError: null,
  };
}

function setDashboardFailureState(
  previousState: RadiusDashboardState,
  error: unknown,
): RadiusDashboardState {
  return {
    ...previousState,
    loading: false,
    refreshing: false,
    dashboardError: getRadiusErrorMessage(
      error,
      RADIUS_MESSAGES.ERROR.DASHBOARD,
    ),
  };
}

function setDashboardSuccessState(
  previousState: RadiusDashboardState,
  nextStats: RadiusDashboardStatsViewModel,
  nextSessions: RadiusRecentSessionViewModel[],
): RadiusDashboardState {
  return {
    ...previousState,
    stats: nextStats,
    sessions: nextSessions,
    loading: false,
    refreshing: false,
    dashboardError: null,
  };
}

/**
 * Refresh dashboard state while preserving the previous data on failure.
 */
export async function refreshRadiusDashboardState(
  previousState: RadiusDashboardState,
  api: Pick<RadiusDashboardApi, "getStats" | "getRecentSessions">,
): Promise<RadiusDashboardState> {
  const loadingState = setDashboardLoadingState(previousState);

  try {
    const [stats, recentSessions] = await Promise.all([
      api.getStats(),
      api.getRecentSessions(),
    ]);

    return setDashboardSuccessState(
      loadingState,
      stats,
      recentSessions.sessions,
    );
  } catch (error) {
    return setDashboardFailureState(previousState, error);
  }
}

/**
 * Apply realtime stats payload to the current dashboard state.
 */
export function applyRealtimeStatsUpdate(
  previousState: RadiusDashboardState,
  nextStats: RadiusDashboardStatsViewModel,
): RadiusDashboardState {
  return {
    ...previousState,
    stats: nextStats,
    dashboardError: null,
  };
}

/**
 * Apply realtime sessions payload to the current dashboard state.
 */
export function applyRealtimeSessionsUpdate(
  previousState: RadiusDashboardState,
  payload: { sessions: RadiusRecentSessionViewModel[] },
): RadiusDashboardState {
  return {
    ...previousState,
    sessions: payload.sessions,
  };
}
