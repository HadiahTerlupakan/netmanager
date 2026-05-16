import { describe, expect, it, vi, beforeEach } from "vitest";
import type { IAppReleaseRepository } from "@/modules/app-version/domain/ports/IAppReleaseRepository";
import type { AppRelease } from "@/modules/app-version/domain/entities/AppReleaseEntity";
import { AppVersionCheckService } from "@/modules/app-version/services/AppVersionCheckService";

function buildRelease(overrides: Partial<AppRelease> = {}): AppRelease {
  return {
    id: "rel-1",
    platform: "android",
    version: "1.0.9",
    versionCode: 9,
    isForceUpdate: false,
    minSupportedVersion: null,
    downloadUrl: "https://example.com/app.apk",
    releaseNotes: "Bug fixes",
    isActive: true,
    releasedAt: new Date("2026-05-17"),
    architecture: null,
    minOsVersion: null,
    rolloutPercentage: 100,
    apkSizeBytes: null,
    tenantId: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("AppVersionCheckService", () => {
  let repo: IAppReleaseRepository;
  let service: AppVersionCheckService;
  let tenantContact: {
    url: string | null;
    label: string | null;
  };

  beforeEach(() => {
    repo = {
      findLatestActive: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    tenantContact = { url: null, label: null };
    service = new AppVersionCheckService(repo, async () => tenantContact);
  });

  it("returns no update when current version equals latest", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({ version: "1.0.7", versionCode: 7 }),
    );

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.updateAvailable).toBe(false);
    expect(result.isForceUpdate).toBe(false);
    expect(result.latestVersion).toBeNull();
  });

  it("returns soft update when current less than latest and not forced", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({ version: "1.0.9", versionCode: 9 }),
    );

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.updateAvailable).toBe(true);
    expect(result.isForceUpdate).toBe(false);
    expect(result.latestVersion?.version).toBe("1.0.9");
  });

  it("returns force update when isForceUpdate flag is true", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({ version: "1.0.9", isForceUpdate: true }),
    );

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.updateAvailable).toBe(true);
    expect(result.isForceUpdate).toBe(true);
  });

  it("returns force update when current is below minSupportedVersion", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({
        version: "1.0.9",
        isForceUpdate: false,
        minSupportedVersion: "1.0.8",
      }),
    );

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.updateAvailable).toBe(true);
    expect(result.isForceUpdate).toBe(true);
  });

  it("returns no update when no active release exists", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(null);

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.updateAvailable).toBe(false);
    expect(result.latestVersion).toBeNull();
  });

  it("includes contact admin from tenant settings when configured", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({ version: "1.0.9" }),
    );
    tenantContact = {
      url: "https://wa.me/628123456789",
      label: "Hubungi Admin via WhatsApp",
    };

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.contactAdmin).toEqual({
      url: "https://wa.me/628123456789",
      label: "Hubungi Admin via WhatsApp",
    });
  });

  it("returns null contactAdmin when tenant settings empty", async () => {
    vi.mocked(repo.findLatestActive).mockResolvedValue(
      buildRelease({ version: "1.0.9" }),
    );

    const result = await service.check({
      platform: "android",
      currentVersion: "1.0.7",
      currentVersionCode: 7,
    });

    expect(result.contactAdmin).toBeNull();
  });
});
