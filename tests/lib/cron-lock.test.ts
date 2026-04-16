import { beforeEach, describe, expect, it, vi } from "vitest";
import { redisMock } from "../setup";

describe("cron lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.set.mockResolvedValue("OK");
  });

  it("returns acquired when Redis grants the lock", async () => {
    const { acquireCronLock } = await import("@/lib/cron-lock");

    const result = await acquireCronLock("attendance-alert", 600);

    expect(result).toBe("acquired");
    expect(redisMock.set).toHaveBeenCalledWith(
      "cron:lock:attendance-alert",
      "1",
      "EX",
      600,
      "NX",
    );
  });

  it("returns locked when another runtime already holds the lock", async () => {
    redisMock.set.mockResolvedValueOnce(null);

    const { acquireCronLock } = await import("@/lib/cron-lock");

    const result = await acquireCronLock("attendance-alert", 600);

    expect(result).toBe("locked");
  });

  it("returns unavailable when Redis lock storage fails", async () => {
    redisMock.set.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const { acquireCronLock } = await import("@/lib/cron-lock");

    const result = await acquireCronLock("attendance-alert", 600);

    expect(result).toBe("unavailable");
  });
});
