import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlayStoreReleaseService } from "@/modules/app-version/services/PlayStoreReleaseService";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-20T00:00:00.000Z");

function stored(versionCode: number, daysAgo: number, cancelled = false) {
  return {
    versionCode,
    versionName: "1.0.9",
    firstSeenAt: new Date(NOW.getTime() - daysAgo * DAY),
    cancelledAt: cancelled ? NOW : null,
  };
}

describe("PlayStoreReleaseService", () => {
  const repository = {
    findAll: vi.fn(),
    recordSeen: vi.fn(),
    setCancelled: vi.fn(),
  };
  const fetchReleases = vi.fn();
  const onChange = vi.fn();

  const service = (
    account: object | null = { client_email: "x", private_key: "y" },
  ) =>
    new PlayStoreReleaseService({
      repository,
      readAccount: () => account as never,
      fetchReleases,
      onChange,
      now: () => NOW,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    repository.findAll.mockResolvedValue([]);
  });

  it("records releases newly seen in the production track", async () => {
    fetchReleases.mockResolvedValue([
      { versionCode: 48, versionName: "1.0.9" },
      { versionCode: 49, versionName: "1.0.9" },
    ]);
    repository.recordSeen.mockImplementation(
      async ({ versionCode }) => versionCode === 49,
    );

    const result = await service().sync();

    expect(result).toEqual({ configured: true, recorded: [49] });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("does nothing and locks nobody until the credential is set", async () => {
    const result = await service(null).sync();

    expect(result).toEqual({ configured: false, recorded: [] });
    expect(fetchReleases).not.toHaveBeenCalled();
  });

  it("describes each release for the admin page", async () => {
    repository.findAll.mockResolvedValue([
      stored(50, 1),
      stored(49, 10),
      stored(48, 40),
    ]);

    const overview = await service().overview();

    expect(overview.credentialConfigured).toBe(true);
    expect(overview.minimum).toEqual({ versionCode: 49, versionName: "1.0.9" });
    expect(
      overview.releases.map((release) => [release.versionCode, release.status]),
    ).toEqual([
      [50, "GRACE"],
      [49, "REQUIRED"],
      [48, "LOCKED_OUT"],
    ]);
    expect(overview.releases[0]!.enforcedFrom).toEqual(
      new Date(NOW.getTime() + DAY),
    );
  });

  it("shows a cancelled release as cancelled", async () => {
    repository.findAll.mockResolvedValue([stored(50, 5, true), stored(49, 10)]);

    const overview = await service().overview();

    expect(overview.releases[0]!.status).toBe("CANCELLED");
    expect(overview.minimum?.versionCode).toBe(49);
  });

  it("cancels and restores enforcement of a release", async () => {
    repository.setCancelled.mockResolvedValue(true);

    await service().setCancelled(50, true, "admin-1");
    await service().setCancelled(50, false, "admin-1");

    expect(repository.setCancelled).toHaveBeenNthCalledWith(1, {
      versionCode: 50,
      cancelledAt: NOW,
      cancelledById: "admin-1",
    });
    expect(repository.setCancelled).toHaveBeenNthCalledWith(2, {
      versionCode: 50,
      cancelledAt: null,
      cancelledById: null,
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
