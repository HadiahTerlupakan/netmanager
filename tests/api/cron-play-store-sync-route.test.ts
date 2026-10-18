import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sync: vi.fn(), acquireCronLock: vi.fn() }));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: mocks.acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE: "lock unavailable",
}));

vi.mock("@/modules/app-version", () => ({
  PlayStoreReleaseService: class {
    sync = mocks.sync;
  },
}));

import { GET } from "@/app/api/cron/play-store-sync/route";

const request = (secret?: string) =>
  new NextRequest("http://localhost/api/cron/play-store-sync", {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

describe("GET /api/cron/play-store-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    mocks.acquireCronLock.mockResolvedValue("acquired");
    mocks.sync.mockResolvedValue({ configured: true, recorded: [49] });
  });

  it("rejects callers without the cron secret", async () => {
    expect((await GET(request())).status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("records new Play Store production releases", async () => {
    const response = await GET(request(process.env.CRON_SECRET));

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      configured: true,
      recorded: [49],
    });
  });
});
