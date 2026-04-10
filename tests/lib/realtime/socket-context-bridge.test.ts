import { describe, expect, it, vi } from "vitest";

const markerProvider = Symbol("provider");
const markerRealtimeState = vi.fn(() => ({
  socket: null,
  transport: null,
  isConnected: true,
  lastError: null,
  reconnect: vi.fn(),
}));
const markerRealtimeSubscription = vi.fn();

vi.mock("@/lib/realtime/RealtimeContext", () => ({
  RealtimeProvider: markerProvider,
  useRealtime: markerRealtimeState,
  useRealtimeSubscription: markerRealtimeSubscription,
}));

describe("SocketContext bridge", () => {
  it("re-exports the realtime provider and delegates socket hooks to it", async () => {
    const { SocketProvider, useSocket, useSocketEvent } =
      await import("@/lib/websocket/SocketContext");
    const handler = vi.fn();

    expect(SocketProvider).toBe(markerProvider);
    expect(useSocket()).toEqual({
      socket: null,
      transport: null,
      isConnected: true,
      lastError: null,
      reconnect: expect.any(Function),
    });

    useSocketEvent("workorder:update", handler);

    expect(markerRealtimeState).toHaveBeenCalledTimes(1);
    expect(markerRealtimeSubscription).toHaveBeenCalledWith(
      "workorder:update",
      handler,
    );
  });
});
