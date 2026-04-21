import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  getPublicPortalSettings: vi.fn(),
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

vi.mock("@/components/LandingPage", () => ({
  default: ({
    brandingName,
    brandingLogoUrl,
  }: {
    brandingName?: string;
    brandingLogoUrl?: string;
  }) => (
    <div
      data-testid="landing-page"
      data-branding-name={brandingName ?? ""}
      data-branding-logo-url={brandingLogoUrl ?? ""}
    />
  ),
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
        if (name === "host") {
          return "sblnet.test";
        }

        if (name === "x-forwarded-proto") {
          return "https";
        }

        return null;
      }),
    });

    mockFns.getPublicPortalSettings.mockResolvedValue({
      namaAplikasi: "SBLNET Public",
      perusahaan: "PT SBLNET",
      appLogoUrl: "https://cdn.example.com/logo-aplikasi.png",
      logoInvoice: "https://cdn.example.com/logo-invoice.png",
      landingLogoUrl: "https://cdn.example.com/logo-landing.png",
    });
  });

  it("passes landingLogoUrl to LandingPage SSR props", async () => {
    const markup = renderToStaticMarkup(await HomePage());

    expect(markup).toContain('data-branding-name="SBLNET Public"');
    expect(markup).toContain(
      'data-branding-logo-url="https://cdn.example.com/logo-landing.png"',
    );
    expect(markup).not.toContain(
      'data-branding-logo-url="https://cdn.example.com/logo-aplikasi.png"',
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

    expect(markup).toContain('data-branding-name="SBLNET Public"');
    expect(markup).toContain('data-branding-logo-url=""');
    expect(markup).not.toContain(
      'data-branding-logo-url="/images/logo-sbl.png"',
    );
  });
});
