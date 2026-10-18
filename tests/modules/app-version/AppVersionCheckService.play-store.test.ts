import { describe, expect, it, vi } from "vitest";

import type { IAppReleaseRepository } from "@/modules/app-version/domain/ports/IAppReleaseRepository";
import {
  AppVersionCheckService,
  PLAY_STORE_URL,
} from "@/modules/app-version/services/AppVersionCheckService";

const SEEN_AT = new Date("2026-10-18T06:00:00.000Z");

function serviceWith(play: {
  latest: {
    versionCode: number;
    versionName: string | null;
    firstSeenAt: Date;
  } | null;
  minimum: { versionCode: number; versionName: string | null } | null;
}) {
  const repo = {
    findLatestActive: vi.fn(async () => null),
  } as unknown as IAppReleaseRepository;
  return new AppVersionCheckService(
    repo,
    async () => ({ url: null, label: null }),
    async () => play,
  );
}

describe("AppVersionCheckService with Play Store releases", () => {
  const latest = {
    versionCode: 49,
    versionName: "1.0.9",
    firstSeenAt: SEEN_AT,
  };

  it("forces an app below the required version to update from the Play Store", async () => {
    const result = await serviceWith({
      latest,
      minimum: { versionCode: 49, versionName: "1.0.9" },
    }).check({
      platform: "android",
      currentVersion: "1.0.9",
      currentVersionCode: 48,
    });

    expect(result).toMatchObject({
      updateAvailable: true,
      isForceUpdate: true,
      latestVersion: {
        version: "1.0.9",
        versionCode: 49,
        downloadUrl: PLAY_STORE_URL,
      },
    });
  });

  it("only suggests the update while the new release is in its grace", async () => {
    const result = await serviceWith({
      latest,
      minimum: { versionCode: 48, versionName: "1.0.9" },
    }).check({
      platform: "android",
      currentVersion: "1.0.9",
      currentVersionCode: 48,
    });

    expect(result).toMatchObject({
      updateAvailable: true,
      isForceUpdate: false,
    });
  });

  it("forces an out-of-sequence old build despite its high build number", async () => {
    const result = await serviceWith({
      latest,
      minimum: { versionCode: 49, versionName: "1.0.9" },
    }).check({
      platform: "android",
      currentVersion: "1.0.0",
      currentVersionCode: 53,
    });

    expect(result).toMatchObject({
      updateAvailable: true,
      isForceUpdate: true,
    });
  });

  it("reports nothing for the current release", async () => {
    const result = await serviceWith({
      latest,
      minimum: { versionCode: 49, versionName: "1.0.9" },
    }).check({
      platform: "android",
      currentVersion: "1.0.9",
      currentVersionCode: 49,
    });

    expect(result).toMatchObject({
      updateAvailable: false,
      isForceUpdate: false,
    });
  });
});
