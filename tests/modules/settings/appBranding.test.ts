import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetR2Settings } = vi.hoisted(() => ({
  mockGetR2Settings: vi.fn(),
}));

import {
  DEFAULT_APP_LOGO_ASSET_PATH,
  resolveAppBranding,
} from "../../../modules/settings/services/appBranding";
import { SettingsRepository } from "../../../modules/settings/repositories/SettingsRepository";
import { getTenantIdFromContext } from "../../../lib/tenant-context";

vi.mock("../../../modules/settings/repositories/SettingsRepository", () => ({
  SettingsRepository: {
    findManyByKeys: vi.fn(),
  },
}));

vi.mock("../../../lib/tenant-context", () => ({
  getTenantIdFromContext: vi.fn(),
}));

vi.mock("../../../lib/utils/r2-client", () => ({
  getR2Settings: mockGetR2Settings,
}));

describe("resolveAppBranding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetR2Settings.mockResolvedValue(null);
  });

  it("returns tenant source when tenant logo exists and normalizes path", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });

    vi.mocked(SettingsRepository.findManyByKeys).mockImplementation(
      async (_keys, tenantId) => {
        if (tenantId === "tenant-1") {
          return [
            {
              key: "LOGO_APLIKASI",
              value: "uploads/tenant-logo.png",
              encrypted: false,
            },
            {
              key: "GENERAL_NAMA_APLIKASI",
              value: "Tenant App",
              encrypted: false,
            },
          ];
        }

        return [
          { key: "LOGO_APLIKASI", value: "global-logo.png", encrypted: false },
          {
            key: "GENERAL_NAMA_APLIKASI",
            value: "Global App",
            encrypted: false,
          },
        ];
      },
    );

    const result = await resolveAppBranding();

    expect(result).toEqual({
      appName: "Tenant App",
      appLogoUrl: "/uploads/tenant-logo.png",
      source: "tenant",
      tenantId: "tenant-1",
    });
  });

  it("returns global source when tenant logo missing and global logo exists", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-2",
      isSuperAdmin: false,
    });

    vi.mocked(SettingsRepository.findManyByKeys).mockImplementation(
      async (_keys, tenantId) => {
        if (tenantId === "tenant-2") {
          return [
            {
              key: "GENERAL_NAMA_APLIKASI",
              value: "Tenant Two",
              encrypted: false,
            },
          ];
        }

        return [
          {
            key: "LOGO_APLIKASI",
            value: "assets/global-logo.png",
            encrypted: false,
          },
          {
            key: "GENERAL_NAMA_APLIKASI",
            value: "Global Name",
            encrypted: false,
          },
        ];
      },
    );

    const result = await resolveAppBranding();

    expect(result.source).toBe("global");
    expect(result.appLogoUrl).toBe("/assets/global-logo.png");
    expect(result.tenantId).toBe("tenant-2");
    expect(result.appName).toBe("Tenant Two");
  });

  it("preserves remote logo URL without converting it into a local path", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-4",
      isSuperAdmin: false,
    });

    vi.mocked(SettingsRepository.findManyByKeys).mockImplementation(
      async (_keys, tenantId) => {
        if (tenantId === "tenant-4") {
          return [
            {
              key: "LOGO_APLIKASI",
              value: "https://cdn.radpro.id/uploads/logos/logo-aplikasi.png",
              encrypted: false,
            },
          ];
        }

        return [];
      },
    );

    const result = await resolveAppBranding();

    expect(result.appLogoUrl).toBe(
      "https://cdn.radpro.id/uploads/logos/logo-aplikasi.png",
    );
    expect(result.source).toBe("tenant");
  });

  it("converts legacy global logo path to R2 public URL when tenant logo missing", async () => {
    mockGetR2Settings.mockResolvedValue({
      accountId: "acc-1",
      accessKeyId: "key-1",
      secretAccessKey: "secret-1",
      bucketName: "bucket-1",
      publicUrl: "https://cdn.radpro.id",
      enabled: true,
    });
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-2",
      isSuperAdmin: false,
    });

    vi.mocked(SettingsRepository.findManyByKeys).mockImplementation(
      async (_keys, tenantId) => {
        if (tenantId === "tenant-2") {
          return [];
        }

        return [
          {
            key: "LOGO_APLIKASI",
            value: "/uploads/logos/logo-aplikasi.png",
            encrypted: false,
          },
          {
            key: "GENERAL_NAMA_APLIKASI",
            value: "Global Name",
            encrypted: false,
          },
        ];
      },
    );

    const result = await resolveAppBranding();

    expect(result).toEqual({
      appName: "Global Name",
      appLogoUrl: "https://cdn.radpro.id/uploads/logos/logo-aplikasi.png",
      source: "global",
      tenantId: "tenant-2",
    });
  });

  it("returns default source and default asset when tenant and global logos are missing", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-3",
      isSuperAdmin: false,
    });

    vi.mocked(SettingsRepository.findManyByKeys).mockImplementation(
      async (_keys, tenantId) => {
        if (tenantId === "tenant-3") {
          return [];
        }

        return [];
      },
    );

    const result = await resolveAppBranding();

    expect(result).toEqual({
      appName: "NetManager",
      appLogoUrl: DEFAULT_APP_LOGO_ASSET_PATH,
      source: "default",
      tenantId: "tenant-3",
    });
  });
});
