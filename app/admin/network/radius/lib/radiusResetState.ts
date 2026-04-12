import { useCallback, useState } from "react";

import type { RadiusDashboardApi } from "./radiusDashboardApi";

export interface RadiusResetState {
  resettingUsername: string | null;
  actionError: string | null;
  actionSuccess: string | null;
}

export interface RadiusResetDependencies {
  resetConnection: RadiusDashboardApi["resetConnection"];
  refreshDashboard: () => Promise<void>;
}

function getResetErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Gagal reset koneksi";
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
          actionError: getResetErrorMessage(error),
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
