import { useCallback, useState } from "react";

import type { RadiusSessionHistoryData } from "./radiusDashboardApi";

export interface RadiusHistoryState {
  historyModalOpen: boolean;
  historyLoading: boolean;
  historyError: string | null;
  historyData: RadiusSessionHistoryData | null;
  historyStartDate: string;
  historyEndDate: string;
  viewingHistoryUsername: string | null;
}

export interface RadiusHistoryDependencies {
  fetchHistory: (input: {
    username: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) => Promise<RadiusSessionHistoryData>;
}

const DEFAULT_HISTORY_PAGE = 1;
const DEFAULT_HISTORY_LIMIT = 20;

export function createInitialRadiusHistoryState(): RadiusHistoryState {
  return {
    historyModalOpen: false,
    historyLoading: false,
    historyError: null,
    historyData: null,
    historyStartDate: "",
    historyEndDate: "",
    viewingHistoryUsername: null,
  };
}

function buildHistoryRequest(input: {
  username: string;
  page?: number;
  startDate?: string;
  endDate?: string;
}): {
  username: string;
  page: number;
  limit: number;
  startDate?: string;
  endDate?: string;
} {
  return {
    username: input.username,
    page: input.page ?? DEFAULT_HISTORY_PAGE,
    limit: DEFAULT_HISTORY_LIMIT,
    ...(input.startDate ? { startDate: input.startDate } : {}),
    ...(input.endDate ? { endDate: input.endDate } : {}),
  };
}

function getHistoryErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Gagal memuat history sesi";
}

/**
 * Manage history modal, filters, paging, and fetch flow.
 */
export function useRadiusHistoryState({
  fetchHistory,
}: RadiusHistoryDependencies) {
  const [state, setState] = useState<RadiusHistoryState>(
    createInitialRadiusHistoryState(),
  );

  const loadHistory = useCallback(
    async (input: {
      username: string;
      page?: number;
      startDate?: string;
      endDate?: string;
    }) => {
      const request = buildHistoryRequest(input);
      setState((previous) => ({
        ...previous,
        historyLoading: true,
        historyError: null,
      }));

      try {
        const historyData = await fetchHistory(request);
        setState((previous) => ({
          ...previous,
          historyModalOpen: true,
          historyLoading: false,
          historyError: null,
          historyData,
          viewingHistoryUsername: request.username,
        }));
      } catch (error) {
        setState((previous) => ({
          ...previous,
          historyModalOpen: true,
          historyLoading: false,
          historyError: getHistoryErrorMessage(error),
        }));
      }
    },
    [fetchHistory],
  );

  const viewHistory = useCallback(
    async (username: string) => {
      if (!username) return;
      await loadHistory({ username, page: DEFAULT_HISTORY_PAGE });
    },
    [loadHistory],
  );

  const changeHistoryPage = useCallback(
    async (page: number) => {
      if (!state.viewingHistoryUsername || page < 1) return;
      await loadHistory({
        username: state.viewingHistoryUsername,
        page,
        startDate: state.historyStartDate || undefined,
        endDate: state.historyEndDate || undefined,
      });
    },
    [
      loadHistory,
      state.historyEndDate,
      state.historyStartDate,
      state.viewingHistoryUsername,
    ],
  );

  const applyHistoryFilter = useCallback(async () => {
    if (!state.viewingHistoryUsername) return;
    await loadHistory({
      username: state.viewingHistoryUsername,
      page: DEFAULT_HISTORY_PAGE,
      startDate: state.historyStartDate || undefined,
      endDate: state.historyEndDate || undefined,
    });
  }, [
    loadHistory,
    state.historyEndDate,
    state.historyStartDate,
    state.viewingHistoryUsername,
  ]);

  const resetHistoryFilter = useCallback(async () => {
    setState((previous) => ({
      ...previous,
      historyStartDate: "",
      historyEndDate: "",
    }));

    if (!state.viewingHistoryUsername) return;

    await loadHistory({
      username: state.viewingHistoryUsername,
      page: DEFAULT_HISTORY_PAGE,
    });
  }, [loadHistory, state.viewingHistoryUsername]);

  const closeHistoryModal = useCallback(() => {
    setState((previous) => ({
      ...previous,
      historyModalOpen: false,
      historyLoading: false,
      historyError: null,
      viewingHistoryUsername: null,
    }));
  }, []);

  return {
    ...state,
    setHistoryStartDate: (value: string) => {
      setState((previous) => ({ ...previous, historyStartDate: value }));
    },
    setHistoryEndDate: (value: string) => {
      setState((previous) => ({ ...previous, historyEndDate: value }));
    },
    viewHistory,
    changeHistoryPage,
    applyHistoryFilter,
    resetHistoryFilter,
    closeHistoryModal,
  };
}
