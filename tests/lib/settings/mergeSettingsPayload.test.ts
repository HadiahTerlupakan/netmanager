import { describe, expect, it } from "vitest";
import { mergeSettingsPayload } from "@/lib/settings/mergeSettingsPayload";

describe("mergeSettingsPayload", () => {
  it("unwraps nested data payload and merges general with logo settings", () => {
    const generalPayload = {
      data: {
        perusahaan: "PT Radpro",
        namaAplikasi: "NetManager",
      },
    };

    const logoPayload = {
      success: true,
      data: {
        data: {
          logoAplikasi: "/uploads/logo-app.png",
          logoInvoice: "/uploads/logo-invoice.png",
        },
      },
    };

    expect(mergeSettingsPayload(generalPayload, logoPayload)).toEqual({
      perusahaan: "PT Radpro",
      namaAplikasi: "NetManager",
      logoAplikasi: "/uploads/logo-app.png",
      logoInvoice: "/uploads/logo-invoice.png",
    });
  });

  it("keeps general settings when logo payload is missing", () => {
    const generalPayload = {
      data: {
        perusahaan: "PT Radpro",
        namaAplikasi: "NetManager",
      },
    };

    expect(mergeSettingsPayload(generalPayload, undefined)).toEqual({
      perusahaan: "PT Radpro",
      namaAplikasi: "NetManager",
    });
  });

  it("returns public branding payload with appLogoUrl for public consumers", () => {
    const result = mergeSettingsPayload(
      { data: { namaAplikasi: "NetManager", perusahaan: "Tenant Co" } },
      { data: { appLogoUrl: "/global/logo.png" } },
    );

    expect(result).toEqual({
      namaAplikasi: "NetManager",
      perusahaan: "Tenant Co",
      appLogoUrl: "/global/logo.png",
    });
  });
});
