import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  getPublicPortalSettings: vi.fn(),
  tenantDomainFindFirst: vi.fn(),
  tenantDomainFindUnique: vi.fn(),
  landingContentGetAllContent: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockFns.cookies,
  headers: mockFns.headers,
}));

vi.mock("next/navigation", () => ({
  redirect: mockFns.redirect,
}));

vi.mock("@/modules/settings", () => ({
  getPublicPortalSettings: mockFns.getPublicPortalSettings,
}));

vi.mock("@/modules/database", () => ({
  prisma: {
    tenantDomain: {
      findFirst: mockFns.tenantDomainFindFirst,
      findUnique: mockFns.tenantDomainFindUnique,
    },
  },
}));

vi.mock("@/modules/website", () => ({
  LandingContentService: class {
    getAllContent = mockFns.landingContentGetAllContent;
  },
}));

vi.mock("@/components/landing/TenantLandingPage", () => ({
  default: ({
    brandingName,
    brandingLogoUrl,
    tenantSlug,
  }: {
    brandingName?: string;
    brandingLogoUrl?: string;
    tenantSlug?: string;
  }) => (
    <div
      data-testid="tenant-landing-page"
      data-branding-name={brandingName ?? ""}
      data-branding-logo-url={brandingLogoUrl ?? ""}
      data-tenant-slug={tenantSlug ?? ""}
    />
  ),
}));

vi.mock("@/components/landing/SaasLandingPage", () => ({
  default: () => <div data-testid="saas-landing-page" />,
}));

import HomePage from "@/app/page";

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFns.cookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });

    mockFns.headers.mockResolvedValue({
      get: vi.fn().mockImplementation((name: string) => {
        if (name === "host") return "tenant-a.example.com";
        if (name === "x-forwarded-host") return null;
        if (name === "x-forwarded-proto") return "https";
        return null;
      }),
    });

    mockFns.tenantDomainFindFirst.mockResolvedValue({
      tenantId: "tenant-1",
      slug: "tenant-a",
    });
    mockFns.tenantDomainFindUnique.mockResolvedValue(null);

    mockFns.getPublicPortalSettings.mockResolvedValue({
      namaAplikasi: "SBLNET Public",
      perusahaan: "PT SBLNET",
      appLogoUrl: "https://cdn.example.com/logo-aplikasi.png",
      logoInvoice: "https://cdn.example.com/logo-invoice.png",
      landingLogoUrl: "https://cdn.example.com/logo-landing.png",
    });

    mockFns.landingContentGetAllContent.mockResolvedValue(null);
  });

  it("passes landingLogoUrl to TenantLandingPage SSR props", async () => {
    const markup = renderToStaticMarkup(await HomePage());

    expect(markup).toContain('data-testid="tenant-landing-page"');
    expect(markup).toContain('data-branding-name="SBLNET Public"');
    expect(markup).toContain(
      'data-branding-logo-url="https://cdn.example.com/logo-landing.png"',
    );
  });

  it("does not force default SSR logo when landing logo is unavailable", async () => {
    mockFns.getPublicPortalSettings.mockResolvedValue({
      namaAplikasi: "SBLNET Public",
      perusahaan: "PT SBLNET",
      appLogoUrl: "https://cdn.example.com/logo-aplikasi.png",
      logoInvoice: "https://cdn.example.com/logo-invoice.png",
      landingLogoUrl: null,
    });

    const markup = renderToStaticMarkup(await HomePage());

    expect(markup).toContain('data-testid="tenant-landing-page"');
    expect(markup).toContain('data-branding-name="SBLNET Public"');
    expect(markup).toContain('data-branding-logo-url=""');
    expect(markup).not.toContain(
      'data-branding-logo-url="/images/logo-sbl.png"',
    );
  });
});
