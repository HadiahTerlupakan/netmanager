import { beforeEach, describe, expect, it, vi } from "vitest";

const realtimeMocks = vi.hoisted(() => {
  const effectCleanups: Array<() => void> = [];
  const mockSubscribeScope = vi.fn(() => vi.fn());
  const mockUseEffect = vi.fn((effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (typeof cleanup === "function") {
      effectCleanups.push(cleanup);
    }
  });
  const mockUseRealtime = vi.fn(() => ({
    subscribeScope: mockSubscribeScope,
    isConnected: true,
  }));

  return {
    effectCleanups,
    mockSubscribeScope,
    mockUseEffect,
    mockUseRealtime,
  };
});

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useEffect: realtimeMocks.mockUseEffect,
  };
});

vi.mock("@/lib/realtime/RealtimeContext", () => ({
  useRealtime: realtimeMocks.mockUseRealtime,
}));

import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";

describe("useRealtimeScope", () => {
  beforeEach(() => {
    realtimeMocks.effectCleanups.splice(0);
    realtimeMocks.mockSubscribeScope.mockReset();
    realtimeMocks.mockSubscribeScope.mockReturnValue(vi.fn());
    realtimeMocks.mockUseEffect.mockClear();
    realtimeMocks.mockUseRealtime.mockReset();
    realtimeMocks.mockUseRealtime.mockReturnValue({
      subscribeScope: realtimeMocks.mockSubscribeScope,
      isConnected: true,
    });
  });

  it("registers the scope through the realtime context when connected", () => {
    const unsubscribe = vi.fn();
    realtimeMocks.mockSubscribeScope.mockReturnValue(unsubscribe);

    useRealtimeScope({ kind: "workorder", id: "wo-1" });

    expect(realtimeMocks.mockSubscribeScope).toHaveBeenCalledWith({
      kind: "workorder",
      id: "wo-1",
    });
    expect(realtimeMocks.effectCleanups).toEqual([unsubscribe]);

    realtimeMocks.effectCleanups[0]();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not register when disconnected", () => {
    realtimeMocks.mockUseRealtime.mockReturnValue({
      subscribeScope: realtimeMocks.mockSubscribeScope,
      isConnected: false,
    });

    useRealtimeScope({ kind: "ticket", id: "ticket-1" });

    expect(realtimeMocks.mockSubscribeScope).not.toHaveBeenCalled();
    expect(realtimeMocks.effectCleanups).toHaveLength(0);
  });

  it("does not register when scope is missing", () => {
    useRealtimeScope(null);

    expect(realtimeMocks.mockSubscribeScope).not.toHaveBeenCalled();
    expect(realtimeMocks.effectCleanups).toHaveLength(0);
  });

  it("does not register when the realtime context has no scope subscriber", () => {
    realtimeMocks.mockUseRealtime.mockReturnValue({
      subscribeScope: undefined,
      isConnected: true,
    });

    useRealtimeScope({ kind: "admin", id: "notifications" });

    expect(realtimeMocks.mockSubscribeScope).not.toHaveBeenCalled();
    expect(realtimeMocks.effectCleanups).toHaveLength(0);
  });
});
