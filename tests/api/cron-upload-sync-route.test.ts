import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sinkron: vi.fn(),
  acquireCronLock: vi.fn(),
}));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: mocks.acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE: "lock unavailable",
}));
vi.mock("@/lib/upload/upload-sync", () => ({
  sinkronkanUploadTertunda: mocks.sinkron,
}));

import { GET } from "@/app/api/cron/upload-sync/route";

const request = (secret?: string) =>
  new NextRequest("http://localhost/api/cron/upload-sync", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

describe("GET /api/cron/upload-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    mocks.acquireCronLock.mockResolvedValue("acquired");
    mocks.sinkron.mockResolvedValue({ tersinkron: 2, gagal: 0, hilang: 0 });
  });

  it("rejects callers without the cron secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect(mocks.sinkron).not.toHaveBeenCalled();
  });

  it("uploads files that are still only on the local volume", async () => {
    const response = await GET(request("cron-secret"));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      tersinkron: 2,
      gagal: 0,
      hilang: 0,
    });
  });

  it("does not run twice at the same time", async () => {
    mocks.acquireCronLock.mockResolvedValue("locked");

    expect((await GET(request("cron-secret"))).status).toBe(409);
    expect(mocks.sinkron).not.toHaveBeenCalled();
  });

  it("lets its lock expire before the next 10-minute run", async () => {
    await GET(request("cron-secret"));

    const [, ttlSeconds] = mocks.acquireCronLock.mock.calls[0] ?? [];
    expect(ttlSeconds).toBeLessThan(10 * 60);
  });
});
