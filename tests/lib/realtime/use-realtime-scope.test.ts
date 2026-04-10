import { beforeEach, describe, expect, it, vi } from "vitest";
import { SOCKET_EVENTS } from "@/lib/websocket/types";

const realtimeMocks = vi.hoisted(() => {
  const effectCleanups: Array<() => void> = [];

  const mockEmit = vi.fn();
  const mockUseEffect = vi.fn((effect: () => void | (() => void)) => {
    const cleanup = effect();
    if (typeof cleanup === "function") {
      effectCleanups.push(cleanup);
    }
  });
  const mockUseMemo = vi.fn((factory: () => unknown) => factory());
  const mockUseRealtime = vi.fn(() => ({
    socket: { emit: mockEmit },
    transport: { emit: mockEmit },
    isConnected: true,
  }));

  return {
    effectCleanups,
    mockEmit,
    mockUseEffect,
    mockUseMemo,
    mockUseRealtime,
  };
});

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useEffect: realtimeMocks.mockUseEffect,
    useMemo: realtimeMocks.mockUseMemo,
  };
});

vi.mock("@/lib/realtime/RealtimeContext", () => ({
  useRealtime: realtimeMocks.mockUseRealtime,
}));

import {
  buildScopeRoomName,
  useRealtimeScope,
} from "@/lib/realtime/hooks/useRealtimeScope";

describe("buildScopeRoomName", () => {
  it("maps realtime scopes to legacy room names during the compatibility phase", () => {
    expect(buildScopeRoomName({ kind: "user", id: "user-1" })).toBe(
      "user:user-1",
    );
    expect(buildScopeRoomName({ kind: "department", id: "dept-1" })).toBe(
      "department:dept-1",
    );
    expect(
      buildScopeRoomName({ kind: "admin", id: "notifications.site.site-1" }),
    ).toBe("admin:notifications.site.site-1");
    expect(buildScopeRoomName({ kind: "workorder", id: "wo-1" })).toBe(
      "workorder:wo-1",
    );
    expect(buildScopeRoomName({ kind: "ticket", id: "ticket-1" })).toBe(
      "ticket:ticket-1",
    );
  });
});

describe("useRealtimeScope", () => {
  beforeEach(() => {
    realtimeMocks.effectCleanups.splice(0);
    realtimeMocks.mockEmit.mockClear();
    realtimeMocks.mockUseEffect.mockClear();
    realtimeMocks.mockUseMemo.mockClear();
    realtimeMocks.mockUseRealtime.mockReset();
    realtimeMocks.mockUseRealtime.mockReturnValue({
      socket: { emit: realtimeMocks.mockEmit },
      transport: { emit: realtimeMocks.mockEmit },
      isConnected: true,
    });
  });

  it("emits joined and left room payloads as object messages for connected scopes", () => {
    useRealtimeScope({ kind: "workorder", id: "wo-1" });

    expect(realtimeMocks.mockEmit).toHaveBeenNthCalledWith(
      1,
      SOCKET_EVENTS.JOIN_ROOM,
      { room: "workorder:wo-1" },
    );
    expect(realtimeMocks.effectCleanups).toHaveLength(1);

    realtimeMocks.effectCleanups[0]();

    expect(realtimeMocks.mockEmit).toHaveBeenNthCalledWith(
      2,
      SOCKET_EVENTS.LEAVE_ROOM,
      { room: "workorder:wo-1" },
    );
  });

  it("does not emit when disconnected", () => {
    realtimeMocks.mockUseRealtime.mockReturnValue({
      socket: { emit: realtimeMocks.mockEmit },
      transport: { emit: realtimeMocks.mockEmit },
      isConnected: false,
    });

    useRealtimeScope({ kind: "ticket", id: "ticket-1" });

    expect(realtimeMocks.mockEmit).not.toHaveBeenCalled();
    expect(realtimeMocks.effectCleanups).toHaveLength(0);
  });

  it("does not emit when scope is missing", () => {
    useRealtimeScope(null);

    expect(realtimeMocks.mockEmit).not.toHaveBeenCalled();
    expect(realtimeMocks.effectCleanups).toHaveLength(0);
  });
});
