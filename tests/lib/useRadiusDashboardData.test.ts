import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RadiusRecentSessionViewModel } from "@/modules/network/services/dashboard/radius-dashboard.contracts";

type DashboardState = {
  stats: {
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
  } | null;
  sessions: RadiusRecentSessionViewModel[];
  loading: boolean;
  refreshing: boolean;
  dashboardError: string | null;
};

const mockUseSession = vi.fn();
const mockUseState = vi.fn();
const mockUseRef = vi.fn((value: unknown) => ({ current: value }));
const mockUseCallback = vi.fn((fn: unknown) => fn);
const mockUseEffect = vi.fn((effect: unknown) => {
  const cleanup = (effect as () => void | (() => void))();
  if (typeof cleanup === "function") cleanup();
});
const mockUseMemo = vi.fn((factory: unknown) => (factory as () => unknown)());
const mockUseRealtime = vi.fn(() => ({
  socket: null,
  isConnected: false,
  lastError: null,
  reconnect: vi.fn(),
}));
const mockUseRealtimeEvent = vi.fn();
const mockUseRealtimeScope = vi.fn();
const mockUseRadiusHistoryState = vi.fn();
const mockUseRadiusResetState = vi.fn();
const mockRefreshRadiusDashboardState = vi.fn();

let dashboardStateStore: DashboardState;
let statsHandler: ((payload: unknown) => void) | null = null;

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: ((initial: unknown) =>
      mockUseState(initial)) as typeof actual.useState,
    useRef: ((value: unknown) => mockUseRef(value)) as typeof actual.useRef,
    useCallback: ((fn: unknown) =>
      mockUseCallback(fn)) as typeof actual.useCallback,
    useEffect: ((effect: unknown) =>
      mockUseEffect(effect)) as typeof actual.useEffect,
    useMemo: ((factory: unknown) =>
      mockUseMemo(factory)) as typeof actual.useMemo,
  };
});

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

vi.mock("@/lib/realtime/RealtimeContext", () => ({
  useRealtime: () => mockUseRealtime(),
  useRealtimeSubscription: vi.fn(),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeEvent", () => ({
  useRealtimeEvent: (...args: unknown[]) => mockUseRealtimeEvent(...args),
}));

vi.mock("@/lib/realtime/hooks/useRealtimeScope", () => ({
  useRealtimeScope: (...args: unknown[]) => mockUseRealtimeScope(...args),
}));

vi.mock("@/app/admin/network/radius/lib/radiusDashboardApi", () => ({
  createRadiusDashboardApi: () => ({
    getStats: vi.fn(),
    getRecentSessions: vi.fn(),
    getHistory: vi.fn(),
    resetConnection: vi.fn(),
  }),
}));

vi.mock("@/app/admin/network/radius/lib/radiusDashboardState", () => ({
  createInitialRadiusDashboardState: (): DashboardState => ({
    stats: null,
    sessions: [],
    loading: true,
    refreshing: false,
    dashboardError: null,
  }),
  refreshRadiusDashboardState: (...args: unknown[]) =>
    mockRefreshRadiusDashboardState(...(args as [unknown, unknown])),
  applyRealtimeStatsUpdate: vi.fn(
    (state: DashboardState, payload: DashboardState["stats"]) => ({
      ...state,
      stats: payload,
      dashboardError: null,
    }),
  ),
  applyRealtimeSessionsUpdate: vi.fn(
    (
      state: DashboardState,
      payload: { sessions: RadiusRecentSessionViewModel[] },
    ) => ({
      ...state,
      sessions: payload.sessions,
    }),
  ),
}));

vi.mock("@/app/admin/network/radius/lib/radiusHistoryState", () => ({
  useRadiusHistoryState: () => mockUseRadiusHistoryState(),
}));

vi.mock("@/app/admin/network/radius/lib/radiusResetState", () => ({
  useRadiusResetState: () => mockUseRadiusResetState(),
}));

import { useRadiusDashboardData } from "@/app/admin/network/radius/hooks/useRadiusDashboardData";

const initialDashboardState = (): DashboardState => ({
  stats: null,
  sessions: [],
  loading: true,
  refreshing: false,
  dashboardError: null,
});

describe("useRadiusDashboardData", () => {
  beforeEach(() => {
    dashboardStateStore = initialDashboardState();
    statsHandler = null;

    mockUseSession.mockReturnValue({
      data: { user: { tenantId: "tenant-1" } },
    });

    mockUseRealtime.mockClear();
    mockUseRealtimeEvent.mockReset();
    mockUseRealtimeScope.mockReset();
    mockUseRadiusHistoryState.mockReturnValue({
      historyModalOpen: false,
      historyLoading: false,
      historyError: null,
      historyData: null,
      historyStartDate: "",
      historyEndDate: "",
      viewingHistoryUsername: null,
      setHistoryStartDate: vi.fn(),
      setHistoryEndDate: vi.fn(),
      viewHistory: vi.fn(),
      changeHistoryPage: vi.fn(),
      applyHistoryFilter: vi.fn(),
      resetHistoryFilter: vi.fn(),
      closeHistoryModal: vi.fn(),
    });
    mockUseRadiusResetState.mockReturnValue({
      resettingUsername: null,
      actionError: null,
      actionSuccess: null,
      setActionError: vi.fn(),
      setActionSuccess: vi.fn(),
      clearActionMessages: vi.fn(),
      resetConnection: vi.fn(),
    });
    mockRefreshRadiusDashboardState.mockReset();
    mockRefreshRadiusDashboardState.mockResolvedValue(initialDashboardState());
    mockUseEffect.mockClear();
    mockUseCallback.mockClear();
    mockUseMemo.mockClear();
    mockUseRef.mockClear();
    mockUseState.mockImplementation((initial: DashboardState) => {
      dashboardStateStore = initial;
      const setState = vi.fn(
        (
          nextValue:
            | DashboardState
            | ((previousState: DashboardState) => DashboardState),
        ) => {
          dashboardStateStore =
            typeof nextValue === "function"
              ? (
                  nextValue as (previousState: DashboardState) => DashboardState
                )(dashboardStateStore)
              : nextValue;
        },
      );

      return [dashboardStateStore, setState];
    });
  });

  it("menyambungkan realtime scope dan event radius", () => {
    const hook = useRadiusDashboardData();

    expect(mockUseRealtimeScope).toHaveBeenCalledWith({
      kind: "admin",
      id: "radius:tenant-1",
    });
    expect(mockUseRealtimeEvent).toHaveBeenCalledWith(
      "radius.stats",
      expect.any(Function),
    );
    expect(mockUseRealtimeEvent).toHaveBeenCalledWith(
      "radius.sessions",
      expect.any(Function),
    );
    expect(hook.dashboardError).toBeNull();
  });

  it("tidak menimpa update realtime saat respons refresh yang lama selesai", async () => {
    const refreshDeferred = createDeferred<DashboardState>();
    mockRefreshRadiusDashboardState.mockReturnValue(refreshDeferred.promise);

    useRadiusDashboardData();

    statsHandler = getRealtimeHandler("radius.stats");
    expect(statsHandler).toBeTypeOf("function");
    expect(mockRefreshRadiusDashboardState).toHaveBeenCalledWith(
      expect.objectContaining({
        stats: null,
        refreshing: true,
      }),
      expect.any(Object),
    );

    statsHandler?.({
      totalUsers: 12,
      onlineUsers: 7,
      offlineUsers: 5,
      totalTrafficToday: {
        download: "120 MB",
        upload: "60 MB",
        downloadGB: 0.12,
        uploadGB: 0.06,
      },
      lastSyncTime: "2026-04-12T02:00:00.000Z",
      lastSyncStats: { created: 3, updated: 2, deleted: 1 },
    });

    refreshDeferred.resolve({
      stats: {
        totalUsers: 4,
        onlineUsers: 1,
        offlineUsers: 3,
        totalTrafficToday: {
          download: "40 MB",
          upload: "20 MB",
          downloadGB: 0.04,
          uploadGB: 0.02,
        },
        lastSyncTime: "2026-04-12T01:00:00.000Z",
        lastSyncStats: { created: 1, updated: 0, deleted: 0 },
      },
      sessions: [buildRadiusSession("stale-session", "stale-user")],
      loading: false,
      refreshing: false,
      dashboardError: null,
    });

    await flushPromises();

    expect(dashboardStateStore.stats).toEqual({
      totalUsers: 12,
      onlineUsers: 7,
      offlineUsers: 5,
      totalTrafficToday: {
        download: "120 MB",
        upload: "60 MB",
        downloadGB: 0.12,
        uploadGB: 0.06,
      },
      lastSyncTime: "2026-04-12T02:00:00.000Z",
      lastSyncStats: { created: 3, updated: 2, deleted: 1 },
    });
    expect(dashboardStateStore.refreshing).toBe(false);
    expect(dashboardStateStore.dashboardError).toBeNull();
  });

  it("mengekspos action dan history state dari komposer", () => {
    const hook = useRadiusDashboardData();

    expect(hook.historyModalOpen).toBe(false);
    expect(hook.resettingUsername).toBeNull();
    expect(typeof hook.refresh).toBe("function");
    expect(typeof hook.resetConnection).toBe("function");
  });
});

function getRealtimeHandler(eventName: "radius.stats" | "radius.sessions") {
  const match = mockUseRealtimeEvent.mock.calls.find(
    ([registeredEventName]) => registeredEventName === eventName,
  );
  const handler = match?.[1];

  if (typeof handler !== "function") {
    return null;
  }

  return handler as (payload: unknown) => void;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function buildRadiusSession(
  radAcctId: string,
  username: string,
): RadiusRecentSessionViewModel {
  return {
    radAcctId,
    username,
    nasIpAddress: "10.0.0.1",
    framedIpAddress: "100.64.0.1",
    acctStartTime: "2026-04-12T00:00:00.000Z",
    acctStopTime: null,
    acctSessionTime: "3600",
    acctInputOctets: "1024",
    acctOutputOctets: "2048",
    uptimeSeconds: 3600,
    uptimeHours: 1,
    downloadMB: 2,
    uploadMB: 1,
    isOnline: true,
    totalUsageGB: 0.003,
  };
}
