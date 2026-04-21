import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetPublicPortalSettings, mockRunWithRequestTenantContext } =
  vi.hoisted(() => ({
    mockGetPublicPortalSettings: vi.fn(),
    mockRunWithRequestTenantContext: vi.fn(
      async (_tenantContext: unknown, callback: () => Promise<unknown>) =>
        callback(),
    ),
  }));

vi.mock("@/modules/settings", () => ({
  getPublicPortalSettings: (...args: unknown[]) =>
    mockGetPublicPortalSettings(...args),
}));

vi.mock("@/lib/tenant-context", () => ({
  runWithRequestTenantContext: mockRunWithRequestTenantContext,
}));

import { GET } from "@/app/api/settings/public/route";

describe("GET /api/settings/public", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunWithRequestTenantContext.mockImplementation(
      async (_tenantContext: unknown, callback: () => Promise<unknown>) =>
        callback(),
    );
  });

  it("returns appLogoUrl in public settings response", async () => {
    mockGetPublicPortalSettings.mockResolvedValue({
      namaAplikasi: "NetManager",
      perusahaan: "PT Radpro",
      appLogoUrl: "/uploads/logo-app.png",
      logoInvoice: "/uploads/logo-invoice.png",
      landingLogoUrl: "/uploads/logo-landing.png",
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
        landingLogoUrl: "/uploads/logo-landing.png",
      },
    });
  });

  it("does not override tenant context with global branding fallback", async () => {
    mockGetPublicPortalSettings.mockResolvedValue({
      namaAplikasi: "Tenant A",
      perusahaan: "PT Tenant",
      appLogoUrl:
        "https://cdn.radpro.id/uploads/logos/1776739266655-logo-aplikasi.png",
      logoInvoice: null,
      landingLogoUrl: null,
    });

    await GET(new NextRequest("http://localhost/api/settings/public"));

    expect(mockRunWithRequestTenantContext).not.toHaveBeenCalled();
  });
});
