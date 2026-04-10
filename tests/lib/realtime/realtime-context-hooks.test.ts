import { describe, expect, it, vi } from "vitest";

const markerProvider = Symbol("provider");
const markerRealtimeState = vi.fn(() => ({
  socket: null,
  transport: null,
  isConnected: true,
  lastError: null,
  reconnect: vi.fn(),
  subscribeScope: vi.fn(),
}));
const markerRealtimeSubscription = vi.fn();

vi.mock("@/lib/realtime/RealtimeContext", () => ({
  RealtimeProvider: markerProvider,
  useRealtime: markerRealtimeState,
  useRealtimeSubscription: markerRealtimeSubscription,
}));

describe("RealtimeContext hooks", () => {
  it("exposes the canonical provider and subscription hooks", async () => {
    const { RealtimeProvider, useRealtime, useRealtimeSubscription } =
      await import("@/lib/realtime/RealtimeContext");
    const handler = vi.fn();

    expect(RealtimeProvider).toBe(markerProvider);
    expect(useRealtime()).toEqual({
      socket: null,
      transport: null,
      isConnected: true,
      lastError: null,
      reconnect: expect.any(Function),
      subscribeScope: expect.any(Function),
    });

    useRealtimeSubscription("workorder:update", handler);

    expect(markerRealtimeState).toHaveBeenCalledTimes(1);
    expect(markerRealtimeSubscription).toHaveBeenCalledWith(
      "workorder:update",
      handler,
    );
  });
});
