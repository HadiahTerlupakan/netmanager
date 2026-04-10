import { describe, expect, it, vi } from "vitest";

import { createSocketTransport } from "@/lib/websocket";

describe("createSocketTransport", () => {
  it("proxies emit/on/off to the provided socket", () => {
    const socket = {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    const transport = createSocketTransport(socket as never);
    const listener = vi.fn();

    transport.emit("ticket:new", { id: "ticket-1" });
    transport.on("ticket:new", listener);
    transport.off("ticket:new", listener);

    expect(socket.emit).toHaveBeenCalledWith("ticket:new", { id: "ticket-1" });
    expect(socket.on).toHaveBeenCalledWith("ticket:new", listener);
    expect(socket.off).toHaveBeenCalledWith("ticket:new", listener);
  });
});
