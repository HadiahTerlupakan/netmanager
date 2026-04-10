import { beforeEach, describe, expect, it, vi } from "vitest";

import { redisMock } from "@/tests/setup";

type RedisQueueMock = typeof redisMock & {
  llen: ReturnType<typeof vi.fn>;
  rpoplpush: ReturnType<typeof vi.fn>;
  lrem: ReturnType<typeof vi.fn>;
  lpush: ReturnType<typeof vi.fn>;
  status?: string;
};

const redisQueueMock = redisMock as unknown as RedisQueueMock;

describe("PushRetryQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(redisQueueMock, {
      llen: vi.fn(),
      rpoplpush: vi.fn(),
      lrem: vi.fn(),
      lpush: vi.fn(),
      status: "ready",
    });
  });

  it("returns empty stats without querying redis when client is not ready", async () => {
    redisQueueMock.status = "wait";

    const { processRetryQueue } =
      await import("@/modules/notification/services/PushRetryQueue");

    await expect(processRetryQueue()).resolves.toEqual({
      processed: 0,
      succeeded: 0,
      dropped: 0,
    });
    expect(redisQueueMock.llen).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns empty stats without querying redis when client is reconnecting", async () => {
    redisQueueMock.status = "reconnecting";

    const { processRetryQueue } =
      await import("@/modules/notification/services/PushRetryQueue");

    await expect(processRetryQueue()).resolves.toEqual({
      processed: 0,
      succeeded: 0,
      dropped: 0,
    });
    expect(redisQueueMock.llen).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("queries redis when client is ready", async () => {
    redisQueueMock.llen.mockResolvedValueOnce(0);

    const { processRetryQueue } =
      await import("@/modules/notification/services/PushRetryQueue");

    await expect(processRetryQueue()).resolves.toEqual({
      processed: 0,
      succeeded: 0,
      dropped: 0,
    });
    expect(redisQueueMock.llen).toHaveBeenCalledTimes(1);
  });

  it("returns empty stats when redis is not writable during processing", async () => {
    const redisError = new Error(
      "Stream isn't writeable and enableOfflineQueue options is false",
    );
    redisQueueMock.llen.mockRejectedValueOnce(redisError);

    const { processRetryQueue } =
      await import("@/modules/notification/services/PushRetryQueue");

    await expect(processRetryQueue()).resolves.toEqual({
      processed: 0,
      succeeded: 0,
      dropped: 0,
    });
    expect(console.error).not.toHaveBeenCalledWith(
      "[PushRetry] Queue processing error:",
      redisError,
    );
  });
});
