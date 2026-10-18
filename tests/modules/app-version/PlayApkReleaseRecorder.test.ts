import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tenant-context", () => ({
  runAsSystemContext: async (_reason: string, run: () => Promise<unknown>) =>
    run(),
}));

import { PlayApkReleaseRecorder } from "@/modules/app-version/services/PlayApkReleaseRecorder";
import { PLAY_STORE_URL } from "@/modules/app-version/services/AppVersionCheckService";
import { MAIN_TENANT_ID } from "@/lib/tenant-constants";
import type { AppReleaseRepository } from "@/modules/app-version/repositories/AppReleaseRepository";

describe("PlayApkReleaseRecorder", () => {
  const repository = { findByVersionCode: vi.fn(), create: vi.fn() };
  const recorder = new PlayApkReleaseRecorder(
    repository as unknown as AppReleaseRepository,
  );

  beforeEach(() => vi.clearAllMocks());

  it("adds a Play production release to the APK release list", async () => {
    repository.findByVersionCode.mockResolvedValue(null);

    await recorder.ensure({ versionCode: 49, versionName: "1.0.9" });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "android",
        version: "1.0.9",
        versionCode: 49,
        downloadUrl: PLAY_STORE_URL,
        tenantId: MAIN_TENANT_ID,
      }),
    );
  });

  it("leaves an existing entry alone, even one the admin deactivated", async () => {
    repository.findByVersionCode.mockResolvedValue({
      id: "rel-49",
      isActive: false,
    });

    await recorder.ensure({ versionCode: 49, versionName: "1.0.9" });

    expect(repository.create).not.toHaveBeenCalled();
  });
});
