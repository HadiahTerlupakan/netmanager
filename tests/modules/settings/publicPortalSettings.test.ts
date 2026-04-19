import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("getPublicPortalSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fallback ke branding global saat tenant context tidak ada dan tetap mengembalikan perusahaan/logoInvoice", async () => {
    vi.mocked(getTenantIdFromContext).mockResolvedValue({
      tenantId: null,
      isSuperAdmin: false,
    });

    vi.mocked(SettingsRepository.findManyByKeys).mockImplementation(
      async (keys, tenantId) => {
        const keySignature = [...keys].sort().join(",");

        if (keySignature === "GENERAL_PERUSAHAAN,LOGO_INVOICE") {
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
    });
  });
});
