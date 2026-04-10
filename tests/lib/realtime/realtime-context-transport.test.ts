import { describe, expect, it, vi } from "vitest";

import { createRealtimeTransport } from "@/lib/realtime/RealtimeContext";

describe("createRealtimeTransport", () => {
  it("proxies emit/on/off to the provided transport source", () => {
    const transportSource = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    const transport = createRealtimeTransport(transportSource);
    const listener = vi.fn();

    transport.emit("ticket:new", { id: "ticket-1" });
    transport.on("ticket:new", listener);
    transport.off("ticket:new", listener);

    expect(transportSource.emit).toHaveBeenCalledWith("ticket:new", {
      id: "ticket-1",
    });
    expect(transportSource.on).toHaveBeenCalledWith("ticket:new", listener);
    expect(transportSource.off).toHaveBeenCalledWith("ticket:new", listener);
  });
});
