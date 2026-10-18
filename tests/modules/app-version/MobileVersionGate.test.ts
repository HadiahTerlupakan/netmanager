import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: { playStoreRelease: { findMany } },
}));

import {
  getMinimumMobileVersion,
  resetMinimumMobileVersionCache,
} from "@/modules/app-version/services/MobileVersionGate";

const LONG_AGO = new Date("2026-01-01T00:00:00.000Z");

describe("getMinimumMobileVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMinimumMobileVersionCache();
    delete process.env.MOBILE_MIN_NATIVE_VERSION_CODE;
  });

  it("reads the production releases once and reuses them briefly", async () => {
    findMany.mockResolvedValue([
      {
        versionCode: 49,
        versionName: "1.0.9",
        firstSeenAt: LONG_AGO,
        cancelledAt: null,
      },
    ]);

    const first = await getMinimumMobileVersion();
    const second = await getMinimumMobileVersion();

    expect(first).toEqual({ versionCode: 49, versionName: "1.0.9" });
    expect(second).toEqual(first);
    expect(findMany).toHaveBeenCalledOnce();
  });

  it("keeps the last known minimum when the database cannot be read", async () => {
    findMany.mockResolvedValueOnce([
      {
        versionCode: 49,
        versionName: "1.0.9",
        firstSeenAt: LONG_AGO,
        cancelledAt: null,
      },
    ]);
    await getMinimumMobileVersion();
    resetMinimumMobileVersionCache({ keepLastKnown: true });
    findMany.mockRejectedValueOnce(new Error("db down"));

    expect(await getMinimumMobileVersion()).toEqual({
      versionCode: 49,
      versionName: "1.0.9",
    });
  });

  it("still honours the manual floor from the environment", async () => {
    process.env.MOBILE_MIN_NATIVE_VERSION_CODE = "40";
    findMany.mockResolvedValue([]);

    expect(await getMinimumMobileVersion()).toEqual({
      versionCode: 40,
      versionName: null,
    });
  });
});
