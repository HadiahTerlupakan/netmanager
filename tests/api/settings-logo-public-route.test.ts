import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetLogoSettings, mockRunWithRequestTenantContext } = vi.hoisted(
  () => ({
    mockGetLogoSettings: vi.fn(),
    mockRunWithRequestTenantContext: vi.fn(
      async (_tenantContext: unknown, callback: () => Promise<unknown>) =>
        callback(),
    ),
  }),
);

vi.mock("@/modules/settings", () => ({
  getLogoSettings: (...args: unknown[]) => mockGetLogoSettings(...args),
}));

vi.mock("@/lib/tenant-context", () => ({
  runWithRequestTenantContext: mockRunWithRequestTenantContext,
}));

import { GET } from "@/app/api/settings/logo/public/route";

describe("GET /api/settings/logo/public", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mengambil logo public tanpa memaksa global tenant context", async () => {
    mockGetLogoSettings.mockResolvedValue({
      logoInvoice: "/uploads/logo-invoice.png",
      logoAplikasi: "/uploads/logo-aplikasi.png",
      logoLandingPage: "/uploads/logo-landing.png",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/settings/logo/public"),
    );
    const payload = await response.json();

    expect(payload).toEqual({
      logoInvoice: "/uploads/logo-invoice.png",
      logoAplikasi: "/uploads/logo-aplikasi.png",
      logoLandingPage: "/uploads/logo-landing.png",
    });
    expect(mockGetLogoSettings).toHaveBeenCalledWith();
    expect(mockRunWithRequestTenantContext).not.toHaveBeenCalled();
  });
});
