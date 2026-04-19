import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAcquireCronLock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: (...args: unknown[]) => mockAcquireCronLock(...args),
}));

describe("cron registry lock helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true only when the distributed lock is acquired", async () => {
    mockAcquireCronLock.mockResolvedValueOnce("acquired");

    const { canRunCronJob } = await import("@/lib/cron-registry");

    const result = await canRunCronJob("billing", 82800);

    expect(result).toBe(true);
    expect(mockAcquireCronLock).toHaveBeenCalledWith("billing", 82800);
  });

  it("returns false when another runtime already holds the lock", async () => {
    mockAcquireCronLock.mockResolvedValueOnce("locked");

    const { canRunCronJob } = await import("@/lib/cron-registry");

    const result = await canRunCronJob("billing", 82800);

    expect(result).toBe(false);
  });

  it("returns false when lock storage is unavailable", async () => {
    mockAcquireCronLock.mockResolvedValueOnce("unavailable");

    const { canRunCronJob } = await import("@/lib/cron-registry");

    const result = await canRunCronJob("billing", 82800);

    expect(result).toBe(false);
  });

  it("does not keep the legacy overtime auto checkout cron registration", () => {
    const file = readFileSync(
      resolve(process.cwd(), "lib/cron-registry.ts"),
      "utf8",
    );

    expect(file).not.toContain("overtimeAutoCheckout");
    expect(file).not.toContain("[Cron] Running overtime auto-checkout");
  });
});
