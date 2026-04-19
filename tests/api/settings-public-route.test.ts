import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPublicPortalSettings = vi.fn();

vi.mock("@/modules/settings", () => ({
  getPublicPortalSettings: (...args: unknown[]) =>
    mockGetPublicPortalSettings(...args),
}));

import { GET } from "@/app/api/settings/public/route";

describe("GET /api/settings/public", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns appLogoUrl in public settings response", async () => {
    mockGetPublicPortalSettings.mockResolvedValue({
      namaAplikasi: "NetManager",
      perusahaan: "PT Radpro",
      appLogoUrl: "/uploads/logo-app.png",
      logoInvoice: "/uploads/logo-invoice.png",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/settings/public"),
    );
    const payload = await response.json();

    expect(payload).toEqual({
      success: true,
      data: {
        namaAplikasi: "NetManager",
        perusahaan: "PT Radpro",
        appLogoUrl: "/uploads/logo-app.png",
        logoInvoice: "/uploads/logo-invoice.png",
      },
    });
  });
});
