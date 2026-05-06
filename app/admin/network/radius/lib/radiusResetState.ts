import { useCallback, useState } from "react";

import type { RadiusDashboardApi } from "./radiusDashboardApi";
import { getRadiusErrorMessage } from "./radiusErrorUtils";
import { RADIUS_MESSAGES } from "../constants";

export interface RadiusResetState {
  resettingUsername: string | null;
  actionError: string | null;
  actionSuccess: string | null;
}

export interface RadiusResetDependencies {
  resetConnection: RadiusDashboardApi["resetConnection"];
  refreshDashboard: () => Promise<void>;
}

/**
 * Manage reset action state and trigger a dashboard refresh after success.
 */
export function useRadiusResetState({
  resetConnection,
  refreshDashboard,
}: RadiusResetDependencies) {
  const [state, setState] = useState<RadiusResetState>({
    resettingUsername: null,
    actionError: null,
    actionSuccess: null,
  });

  const clearActionMessages = useCallback(() => {
    setState((previous) => ({
      ...previous,
      actionError: null,
      actionSuccess: null,
    }));
  }, []);

  const resetConnectionAction = useCallback(
    async (username: string) => {
      if (!username) return;

      setState((previous) => ({
        ...previous,
        actionError: null,
        actionSuccess: null,
        resettingUsername: username,
      }));

      try {
        const result = await resetConnection(username);
        await refreshDashboard();
        setState((previous) => ({
          ...previous,
          actionSuccess: `Reset koneksi ${username} berhasil (${result.disconnected} sesi diputus)`,
        }));
      } catch (error) {
        setState((previous) => ({
          ...previous,
          actionError: getRadiusErrorMessage(
            error,
            RADIUS_MESSAGES.ERROR.RESET,
          ),
        }));
      } finally {
        setState((previous) => ({
          ...previous,
          resettingUsername: null,
        }));
      }
    },
    [refreshDashboard, resetConnection],
  );

  return {
    ...state,
    setActionError: (value: string | null) => {
      setState((previous) => ({ ...previous, actionError: value }));
    },
    setActionSuccess: (value: string | null) => {
      setState((previous) => ({ ...previous, actionSuccess: value }));
    },
    clearActionMessages,
    resetConnection: resetConnectionAction,
  };
}
