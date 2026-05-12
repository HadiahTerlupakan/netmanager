import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
const loggerInfo = vi.fn();
const loggerWarn = vi.fn();

vi.mock("@/modules/database", () => ({
  prisma: {
    $queryRaw: queryRaw,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: loggerInfo,
    warn: loggerWarn,
    error: vi.fn(),
  },
}));

describe("waitForDatabaseReady", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    queryRaw.mockReset();
  });

  it("menunggu sampai query database berhasil sebelum melanjutkan bootstrap monitor", async () => {
    queryRaw
      .mockRejectedValueOnce(
        new Error("Connection terminated due to connection timeout"),
      )
      .mockRejectedValueOnce(
        new Error("Connection terminated due to connection timeout"),
      )
      .mockResolvedValueOnce([{ "?column?": 1 }]);

    const { waitForDatabaseReady } =
      await import("@/modules/network/services/monitorBootstrap");

    const readinessPromise = waitForDatabaseReady({
      retryDelayMs: 1000,
      maxAttempts: 3,
    });

    await vi.advanceTimersByTimeAsync(2000);
    await readinessPromise;

    expect(queryRaw).toHaveBeenCalledTimes(3);
    expect(loggerWarn).toHaveBeenCalledTimes(2);
    expect(loggerInfo).toHaveBeenCalledWith(
      "[MonitorBootstrap] Database ready on attempt 3/3",
    );
  });
});
