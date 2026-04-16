import { beforeEach, describe, expect, it, vi } from "vitest";
import { cache } from "@/lib/cache";
import { AttendanceIdempotencyService } from "@/modules/attendance/services/AttendanceIdempotencyService";

const redisStore = new Map<string, { value: string; expiresAt: number }>();

vi.mock("@/lib/redis", () => {
  const get = vi.fn(async (key: string) => {
    const entry = redisStore.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      redisStore.delete(key);
      return null;
    }

    return entry.value;
  });

  const set = vi.fn(
    async (
      key: string,
      value: string,
      mode?: string,
      ttlSeconds?: number,
      nxMode?: string,
    ) => {
      const ttl = typeof ttlSeconds === "number" ? ttlSeconds : 86400;
      const now = Date.now();
      const existing = redisStore.get(key);
      const canWrite = !(
        mode === "EX" &&
        nxMode === "NX" &&
        existing &&
        existing.expiresAt > now
      );

      if (!canWrite) {
        return null;
      }

      redisStore.set(key, {
        value,
        expiresAt: now + ttl * 1000,
      });
      return "OK";
    },
  );

  const setex = vi.fn(
    async (key: string, ttlSeconds: number, value: string) => {
      redisStore.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
      return "OK";
    },
  );

  const del = vi.fn(async (key: string) => {
    const existed = redisStore.has(key);
    redisStore.delete(key);
    return existed ? 1 : 0;
  });

  return {
    redis: { get, set, setex, del },
  };
});

describe("AttendanceIdempotencyService", () => {
  const service = new AttendanceIdempotencyService();

  beforeEach(() => {
    cache.clear();
    redisStore.clear();
  });

  it("resolves requestId from header first", () => {
    const requestId = service.resolveRequestId("header-123", "body-999");

    expect(requestId).toBe("header-123");
  });

  it("uses requestId from body when header is missing", () => {
    const requestId = service.resolveRequestId(null, "body-999");

    expect(requestId).toBe("body-999");
  });

  it("returns null when both header and body requestId are missing", () => {
    const requestId = service.resolveRequestId(null, undefined);

    expect(requestId).toBeNull();
  });

  it("marks request as in-progress and blocks duplicates while processing", async () => {
    const payloadHash = service.buildPayloadHash({
      latitude: -6.2,
      longitude: 106.8,
    });
    const first = await service.begin(
      "user-1",
      "check-in",
      "req-1",
      payloadHash,
    );
    const second = await service.begin(
      "user-1",
      "check-in",
      "req-1",
      payloadHash,
    );

    expect(first).toBe("started");
    expect(second).toBe("in-progress");
  });

  it("returns replay payload after request completed", async () => {
    const payloadHash = service.buildPayloadHash({ location: "HQ" });
    await service.begin("user-1", "check-out", "req-2", payloadHash);
    await service.complete("user-1", "check-out", "req-2", payloadHash, {
      success: true,
      data: { id: "attendance-1" },
      warning: "test-warning",
    });

    const replay = await service.getReplay("user-1", "check-out", "req-2");

    expect(replay).toEqual({
      success: true,
      data: { id: "attendance-1" },
      warning: "test-warning",
    });
  });

  it("returns hash-mismatch when same request id is reused with different payload", async () => {
    const firstHash = service.buildPayloadHash({
      location: "Site A",
      latitude: 1,
    });
    const secondHash = service.buildPayloadHash({
      location: "Site B",
      latitude: 2,
    });

    const first = await service.begin("user-1", "check-in", "req-3", firstHash);
    const second = await service.begin(
      "user-1",
      "check-in",
      "req-3",
      secondHash,
    );

    expect(first).toBe("started");
    expect(second).toBe("hash-mismatch");
  });

  it("allows retry after in-progress lock is released", async () => {
    const payloadHash = service.buildPayloadHash({ location: "Retry Spot" });
    await service.begin("user-1", "check-in", "req-4", payloadHash);
    await service.release("user-1", "check-in", "req-4");

    const result = await service.begin(
      "user-1",
      "check-in",
      "req-4",
      payloadHash,
    );
    expect(result).toBe("started");
  });

  it("uses deterministic payload hash regardless object key order", () => {
    const hashA = service.buildPayloadHash({
      latitude: -6.2,
      longitude: 106.8,
      location: "HQ",
    });
    const hashB = service.buildPayloadHash({
      location: "HQ",
      longitude: 106.8,
      latitude: -6.2,
    });

    expect(hashA).toBe(hashB);
  });

  it("returns completed when key is already completed with same payload hash", async () => {
    const payloadHash = service.buildPayloadHash({
      location: "Completed Site",
    });
    await service.begin("user-1", "check-out", "req-5", payloadHash);
    await service.complete("user-1", "check-out", "req-5", payloadHash, {
      success: true,
      data: { id: "a1" },
    });

    const beginAgain = await service.begin(
      "user-1",
      "check-out",
      "req-5",
      payloadHash,
    );
    expect(beginAgain).toBe("completed");
  });

  it("returns unavailable when redis idempotency storage fails", async () => {
    const redisModule = await import("@/lib/redis");
    vi.mocked(redisModule.redis.set).mockRejectedValueOnce(
      new Error("redis unavailable"),
    );

    const payloadHash = service.buildPayloadHash({ location: "Fallback Site" });
    const result = await service.begin(
      "user-fallback",
      "check-in",
      "req-6",
      payloadHash,
    );

    expect(result).toBe("unavailable");
  });
});
