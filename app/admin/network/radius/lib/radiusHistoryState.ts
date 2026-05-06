import { useCallback, useState } from "react";

import type { RadiusSessionHistoryData } from "./radiusDashboardApi";
import { getRadiusErrorMessage } from "./radiusErrorUtils";
import { RADIUS_CONSTANTS, RADIUS_MESSAGES } from "../constants";

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
    page: input.page ?? RADIUS_CONSTANTS.HISTORY_PAGE_DEFAULT,
    limit: RADIUS_CONSTANTS.HISTORY_LIMIT_DEFAULT,
    ...(input.startDate ? { startDate: input.startDate } : {}),
    ...(input.endDate ? { endDate: input.endDate } : {}),
  };
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
          historyError: getRadiusErrorMessage(
            error,
            RADIUS_MESSAGES.ERROR.HISTORY,
          ),
        }));
      }
    },
    [fetchHistory],
  );

  const viewHistory = useCallback(
    async (username: string) => {
      if (!username) return;
      await loadHistory({
        username,
        page: RADIUS_CONSTANTS.HISTORY_PAGE_DEFAULT,
      });
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
      page: RADIUS_CONSTANTS.HISTORY_PAGE_DEFAULT,
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
      page: RADIUS_CONSTANTS.HISTORY_PAGE_DEFAULT,
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
