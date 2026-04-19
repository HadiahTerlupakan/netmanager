import { describe, expect, it } from "vitest";
import { parsePublicBrandingPayload } from "@/hooks/usePublicBranding";

describe("parsePublicBrandingPayload", () => {
  it("extracts namaAplikasi and appLogoUrl from nested public settings payload", () => {
    const payload = {
      success: true,
      data: {
        data: {
          namaAplikasi: "Tenant Net",
          appLogoUrl: "/uploads/tenant-logo.png",
        },
      },
    };

    expect(parsePublicBrandingPayload(payload)).toEqual({
      namaAplikasi: "Tenant Net",
      appLogoUrl: "/uploads/tenant-logo.png",
    });
  });

  it("returns null when payload has no branding fields", () => {
    expect(
      parsePublicBrandingPayload({ data: { perusahaan: "Tenant Co" } }),
    ).toBeNull();
  });

  it("returns null when appLogoUrl contains only whitespace", () => {
    const payload = {
      data: {
        data: {
          appLogoUrl: "   ",
        },
      },
    };

    expect(parsePublicBrandingPayload(payload)).toBeNull();
  });
});
