import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetR2Settings } = vi.hoisted(() => ({
  mockGetR2Settings: vi.fn(),
}));

import { getTenantIdFromContext } from "../../../lib/tenant-context";
import { SettingsRepository } from "../../../modules/settings/repositories/SettingsRepository";
import { getPublicPortalSettings } from "../../../modules/settings/services/publicPortalSettings";

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

describe("getPublicPortalSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetR2Settings.mockResolvedValue(null);
  });

  it("fallback ke branding global saat tenant context tidak ada dan tetap mengembalikan perusahaan/logoInvoice", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: null,
      isSuperAdmin: false,
    });

    vi.mocked(SettingsRepository.findManyByKeys).mockImplementation(
      async (keys, tenantId) => {
        const keySignature = [...keys].sort().join(",");

        if (
          keySignature === "GENERAL_PERUSAHAAN,LOGO_INVOICE,LOGO_LANDING_PAGE"
        ) {
          expect(tenantId).toBeUndefined();
          return [
            {
              key: "GENERAL_PERUSAHAAN",
              value: "PT Rad Pro",
              encrypted: false,
            },
            {
              key: "LOGO_INVOICE",
              value: "/uploads/logo-invoice.png",
              encrypted: false,
            },
            {
              key: "LOGO_LANDING_PAGE",
              value: "/uploads/logo-landing.png",
              encrypted: false,
            },
          ];
        }

        if (keySignature === "GENERAL_NAMA_APLIKASI,LOGO_APLIKASI") {
          expect(tenantId).toBeUndefined();
          return [
            {
              key: "GENERAL_NAMA_APLIKASI",
              value: "Global Radpro",
              encrypted: false,
            },
            {
              key: "LOGO_APLIKASI",
              value: "uploads/global-logo.png",
              encrypted: false,
            },
          ];
        }

        return [];
      },
    );

    const result = await getPublicPortalSettings();

    expect(result).toEqual({
      namaAplikasi: "Global Radpro",
      perusahaan: "PT Rad Pro",
      appLogoUrl: "/uploads/global-logo.png",
      logoInvoice: "/uploads/logo-invoice.png",
      landingLogoUrl: "/uploads/logo-landing.png",
    });
  });

  it("menormalisasi logo invoice dan landing legacy ke public URL R2", async () => {
    mockGetR2Settings.mockResolvedValue({
      accountId: "acc-1",
      accessKeyId: "key-1",
      secretAccessKey: "secret-1",
      bucketName: "bucket-1",
      publicUrl: "https://cdn.radpro.id",
      enabled: true,
    });
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: null,
      isSuperAdmin: false,
    });

    vi.mocked(SettingsRepository.findManyByKeys).mockImplementation(
      async (keys, tenantId) => {
        const keySignature = [...keys].sort().join(",");

        if (
          keySignature === "GENERAL_PERUSAHAAN,LOGO_INVOICE,LOGO_LANDING_PAGE"
        ) {
          expect(tenantId).toBeUndefined();
          return [
            {
              key: "GENERAL_PERUSAHAAN",
              value: "PT Rad Pro",
              encrypted: false,
            },
            {
              key: "LOGO_INVOICE",
              value: "/uploads/logo-invoice.png",
              encrypted: false,
            },
            {
              key: "LOGO_LANDING_PAGE",
              value: "uploads/logo-landing.png",
              encrypted: false,
            },
          ];
        }

        if (keySignature === "GENERAL_NAMA_APLIKASI,LOGO_APLIKASI") {
          return [
            {
              key: "GENERAL_NAMA_APLIKASI",
              value: "Global Radpro",
              encrypted: false,
            },
            {
              key: "LOGO_APLIKASI",
              value: "uploads/global-logo.png",
              encrypted: false,
            },
          ];
        }

        return [];
      },
    );

    await expect(getPublicPortalSettings()).resolves.toEqual({
      namaAplikasi: "Global Radpro",
      perusahaan: "PT Rad Pro",
      appLogoUrl: "https://cdn.radpro.id/uploads/global-logo.png",
      logoInvoice: "https://cdn.radpro.id/uploads/logo-invoice.png",
      landingLogoUrl: "https://cdn.radpro.id/uploads/logo-landing.png",
    });
  });

  it("mengembalikan logo landing tenant meski branding aplikasi fallback ke global", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: "tenant-1",
      isSuperAdmin: false,
    });

    vi.mocked(SettingsRepository.findManyByKeys).mockImplementation(
      async (keys, tenantId) => {
        const keySignature = [...keys].sort().join(",");

        if (
          keySignature === "GENERAL_PERUSAHAAN,LOGO_INVOICE,LOGO_LANDING_PAGE"
        ) {
          if (tenantId === "tenant-1") {
            return [
              {
                key: "GENERAL_PERUSAHAAN",
                value: "PT Tenant",
                encrypted: false,
              },
              {
                key: "LOGO_LANDING_PAGE",
                value: "/uploads/tenant-logo-landing.png",
                encrypted: false,
              },
            ];
          }

          expect(tenantId).toBeUndefined();
          return [
            {
              key: "GENERAL_PERUSAHAAN",
              value: "PT Global",
              encrypted: false,
            },
            {
              key: "LOGO_INVOICE",
              value: "/uploads/global-logo-invoice.png",
              encrypted: false,
            },
          ];
        }

        if (keySignature === "GENERAL_NAMA_APLIKASI,LOGO_APLIKASI") {
          if (tenantId === "tenant-1") {
            return [
              {
                key: "GENERAL_NAMA_APLIKASI",
                value: "Tenant One",
                encrypted: false,
              },
            ];
          }

          expect(tenantId).toBeUndefined();
          return [
            {
              key: "GENERAL_NAMA_APLIKASI",
              value: "Global Radpro",
              encrypted: false,
            },
            {
              key: "LOGO_APLIKASI",
              value: "/uploads/global-logo.png",
              encrypted: false,
            },
          ];
        }

        return [];
      },
    );

    await expect(getPublicPortalSettings()).resolves.toEqual({
      namaAplikasi: "Tenant One",
      perusahaan: "PT Tenant",
      appLogoUrl: "/uploads/global-logo.png",
      logoInvoice: "/uploads/global-logo-invoice.png",
      landingLogoUrl: "/uploads/tenant-logo-landing.png",
    });
  });
});
