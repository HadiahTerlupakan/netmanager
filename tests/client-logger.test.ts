import { afterEach, describe, expect, it, vi } from "vitest";

import { clientLogger } from "@/lib/client-logger";

describe("clientLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes Error arguments so console output keeps the message", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    clientLogger.error(
      "[Notifications] Error fetching:",
      new Error("route failed"),
    );

    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining(
        "[ERROR] [Notifications] Error fetching: Error: route failed",
      ),
      {
        args: [
          expect.objectContaining({ name: "Error", message: "route failed" }),
        ],
      },
    );
  });
});
