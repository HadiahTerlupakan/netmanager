import { beforeEach, describe, expect, it, vi } from "vitest";

const realtimeMocks = vi.hoisted(() => ({
  realtimeSubscriptionMock: vi.fn(),
}));

vi.mock("@/lib/realtime/RealtimeContext", () => ({
  useRealtimeSubscription: realtimeMocks.realtimeSubscriptionMock,
}));

import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";

describe("useRealtimeEvent", () => {
  beforeEach(() => {
    realtimeMocks.realtimeSubscriptionMock.mockReset();
  });

  it("delegates canonical event names unchanged to the realtime subscription boundary", () => {
    const handler = vi.fn();

    useRealtimeEvent("notification.new", handler);

    expect(realtimeMocks.realtimeSubscriptionMock).toHaveBeenCalledWith(
      "notification.new",
      handler,
    );
  });
});
