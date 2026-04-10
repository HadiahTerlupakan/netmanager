import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
const mockUseState = vi.fn();
const mockUseCallback = vi.fn((fn, _deps?: unknown[]) => fn);
const mockUseEffect = vi.fn();
const mockUseRealtime = vi.fn(() => ({
  socket: null,
  isConnected: false,
  lastError: null,
  reconnect: vi.fn(),
}));
const mockUseRealtimeEvent = vi.fn();
const mockUseRealtimeScope = vi.fn();
const fetchMock = vi.fn();

Object.defineProperty(globalThis, "fetch", {
  value: fetchMock,
  writable: true,
});

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: (...args: unknown[]) => mockUseState(...(args as [unknown])),
    useCallback: (...args: unknown[]) =>
      mockUseCallback(
        ...(args as [(...input: unknown[]) => unknown, unknown[]?]),
      ),
    useEffect: (...args: unknown[]) =>
      mockUseEffect(...(args as [() => void | (() => void), unknown[]?])),
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

import { useRadiusDashboardData } from "@/app/admin/network/radius/hooks/useRadiusDashboardData";

describe("useRadiusDashboardData", () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      data: { user: { tenantId: "tenant-1" } },
    });

    mockUseRealtime.mockClear();
    mockUseRealtimeEvent.mockReset();
    mockUseRealtimeScope.mockReset();
    fetchMock.mockReset();
    mockUseEffect.mockReset();
    mockUseCallback.mockClear();
    mockUseState.mockReset();
  });

  it("subscribes radius dashboard through realtime scope and event boundaries", () => {
    const stateSetters = Array.from({ length: 14 }, () => vi.fn());

    mockUseState
      .mockReturnValueOnce([null, stateSetters[0]])
      .mockReturnValueOnce([null, stateSetters[1]])
      .mockReturnValueOnce([false, stateSetters[2]])
      .mockReturnValueOnce([false, stateSetters[3]])
      .mockReturnValueOnce([null, stateSetters[4]])
      .mockReturnValueOnce([null, stateSetters[5]])
      .mockReturnValueOnce(["", stateSetters[6]])
      .mockReturnValueOnce(["", stateSetters[7]])
      .mockReturnValueOnce([null, stateSetters[8]])
      .mockReturnValueOnce([null, stateSetters[9]])
      .mockReturnValueOnce([null, stateSetters[10]])
      .mockReturnValueOnce([[], stateSetters[11]])
      .mockReturnValueOnce([true, stateSetters[12]])
      .mockReturnValueOnce([false, stateSetters[13]]);

    useRadiusDashboardData();

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
  });

  it("clears history row loading state when modal is closed", () => {
    const setResettingUsername = vi.fn();
    const setViewingHistoryUsername = vi.fn();
    const setHistoryModalOpen = vi.fn();
    const setHistoryLoading = vi.fn();
    const setHistoryError = vi.fn();
    const setHistoryData = vi.fn();
    const setHistoryStartDate = vi.fn();
    const setHistoryEndDate = vi.fn();
    const setActionError = vi.fn();
    const setActionSuccess = vi.fn();
    const setStats = vi.fn();
    const setSessions = vi.fn();
    const setLoading = vi.fn();
    const setRefreshing = vi.fn();

    mockUseState
      .mockReturnValueOnce([null, setResettingUsername])
      .mockReturnValueOnce(["test-user", setViewingHistoryUsername])
      .mockReturnValueOnce([true, setHistoryModalOpen])
      .mockReturnValueOnce([false, setHistoryLoading])
      .mockReturnValueOnce([null, setHistoryError])
      .mockReturnValueOnce([null, setHistoryData])
      .mockReturnValueOnce(["", setHistoryStartDate])
      .mockReturnValueOnce(["", setHistoryEndDate])
      .mockReturnValueOnce([null, setActionError])
      .mockReturnValueOnce([null, setActionSuccess])
      .mockReturnValueOnce([null, setStats])
      .mockReturnValueOnce([[], setSessions])
      .mockReturnValueOnce([true, setLoading])
      .mockReturnValueOnce([false, setRefreshing]);

    const hook = useRadiusDashboardData();

    hook.closeHistoryModal();

    expect(setHistoryModalOpen).toHaveBeenCalledWith(false);
    expect(setHistoryError).toHaveBeenCalledWith(null);
    expect(setViewingHistoryUsername).toHaveBeenCalledWith(null);
  });
});
