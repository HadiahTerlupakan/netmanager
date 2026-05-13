import { useCallback, useState } from "react";

import type { RadiusDashboardApi } from "./radiusDashboardApi";
import { getRadiusErrorMessage } from "./radiusErrorUtils";
import { RADIUS_MESSAGES } from "../constants";

export interface RadiusResetState {
  resettingUsername: string | null;
  deletingUsername: string | null;
  actionError: string | null;
  actionSuccess: string | null;
}

export interface RadiusResetDependencies {
  resetConnection: RadiusDashboardApi["resetConnection"];
  forceDeleteUser: RadiusDashboardApi["forceDeleteUser"];
  refreshDashboard: () => Promise<void>;
}

/**
 * Manage reset/delete action state and trigger a dashboard refresh after success.
 */
export function useRadiusResetState({
  resetConnection,
  forceDeleteUser,
  refreshDashboard,
}: RadiusResetDependencies) {
  const [state, setState] = useState<RadiusResetState>({
    resettingUsername: null,
    deletingUsername: null,
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

  const forceDeleteUserAction = useCallback(
    async (username: string) => {
      if (!username) return;

      setState((previous) => ({
        ...previous,
        actionError: null,
        actionSuccess: null,
        deletingUsername: username,
      }));

      try {
        await forceDeleteUser(username);
        await refreshDashboard();
        setState((previous) => ({
          ...previous,
          actionSuccess: `User ${username} berhasil dihapus dari RADIUS`,
        }));
      } catch (error) {
        setState((previous) => ({
          ...previous,
          actionError: getRadiusErrorMessage(
            error,
            RADIUS_MESSAGES.ERROR.DELETE_USER,
          ),
        }));
      } finally {
        setState((previous) => ({
          ...previous,
          deletingUsername: null,
        }));
      }
    },
    [forceDeleteUser, refreshDashboard],
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
    forceDeleteUser: forceDeleteUserAction,
  };
}
