import { describe, expect, it } from "vitest";

import {
  isMobileVersionSupported,
  resolveMinimumMobileVersion,
} from "@/modules/app-version/services/mobile-version-policy";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-10-20T00:00:00.000Z");

function release(
  versionCode: number,
  versionName: string,
  hoursAgo: number,
  cancelled = false,
) {
  return {
    versionCode,
    versionName,
    firstSeenAt: new Date(NOW.getTime() - hoursAgo * HOUR),
    cancelledAt: cancelled ? NOW : null,
  };
}

describe("resolveMinimumMobileVersion", () => {
  it("requires only the latest production release once its grace has passed", () => {
    const minimum = resolveMinimumMobileVersion(
      [release(48, "1.0.9", 400), release(49, "1.0.9", 49)],
      NOW,
    );

    expect(minimum).toEqual({ versionCode: 49, versionName: "1.0.9" });
  });

  it("keeps the previous release allowed while the new one is in its grace", () => {
    const minimum = resolveMinimumMobileVersion(
      [release(48, "1.0.9", 400), release(49, "1.0.9", 47)],
      NOW,
    );

    expect(minimum).toEqual({ versionCode: 48, versionName: "1.0.9" });
  });

  it("locks nothing while the only known release is still in its grace", () => {
    expect(
      resolveMinimumMobileVersion([release(48, "1.0.9", 1)], NOW),
    ).toBeNull();
  });

  it("falls back to the previous release when an admin cancelled the newest", () => {
    const minimum = resolveMinimumMobileVersion(
      [release(48, "1.0.9", 400), release(49, "1.0.10", 100, true)],
      NOW,
    );

    expect(minimum).toEqual({ versionCode: 48, versionName: "1.0.9" });
  });

  it("requires a release right away once an admin enforced it early", () => {
    const minimum = resolveMinimumMobileVersion(
      [
        release(48, "1.0.9", 400),
        {
          ...release(49, "1.0.9", 1),
          enforcedFrom: new Date(NOW.getTime() - HOUR),
        },
      ],
      NOW,
    );

    expect(minimum).toEqual({ versionCode: 49, versionName: "1.0.9" });
  });

  it("locks nothing before any release is known", () => {
    expect(resolveMinimumMobileVersion([], NOW)).toBeNull();
  });
});

describe("isMobileVersionSupported", () => {
  const minimum = { versionCode: 49, versionName: "1.0.9" };

  it("accepts the required version", () => {
    expect(
      isMobileVersionSupported(
        { versionCode: 49, versionName: "1.0.9" },
        minimum,
      ),
    ).toBe(true);
  });

  it("rejects an older build", () => {
    expect(
      isMobileVersionSupported(
        { versionCode: 48, versionName: "1.0.9" },
        minimum,
      ),
    ).toBe(false);
  });

  it("rejects an old app whose build number is out of sequence", () => {
    // APK lama di luar Play Store: versi 1.0.0 tetapi build 53.
    expect(
      isMobileVersionSupported(
        { versionCode: 53, versionName: "1.0.0" },
        minimum,
      ),
    ).toBe(false);
  });

  it("compares version names numerically, not as text", () => {
    expect(
      isMobileVersionSupported(
        { versionCode: 60, versionName: "1.0.10" },
        minimum,
      ),
    ).toBe(true);
  });

  it("rejects an app that does not report its build", () => {
    expect(
      isMobileVersionSupported({ versionCode: 0, versionName: null }, minimum),
    ).toBe(false);
  });

  it("accepts every app while no minimum is in force", () => {
    expect(
      isMobileVersionSupported({ versionCode: 0, versionName: null }, null),
    ).toBe(true);
  });
});
