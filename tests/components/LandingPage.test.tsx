import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePublicBranding = vi.fn();

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { alt, ...rest } = props;
    return `<img alt="${String(alt)}" />${JSON.stringify(rest)}`;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/hooks/usePublicBranding", () => ({
  DEFAULT_PUBLIC_APP_NAME: "NetManager",
  DEFAULT_PUBLIC_APP_LOGO_URL: "/images/logo-sbl.png",
  usePublicBranding: () => mockUsePublicBranding(),
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({ children }: { children: unknown }) => children,
}));

import LandingPage from "@/components/LandingPage";

describe("LandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps SSR landing logo when public branding hook only provides app logo", () => {
    mockUsePublicBranding.mockReturnValue({
      branding: {
        namaAplikasi: "SBLNET Public",
        appLogoUrl: "/uploads/logos/logo-aplikasi.png",
      },
      loading: false,
      error: null,
    });

    const markup = renderToStaticMarkup(
      <LandingPage
        brandingName="SBLNET Public"
        brandingLogoUrl="https://cdn.radpro.id/uploads/logos/logo-landing-page.png"
      />,
    );

    expect(markup).toContain(
      "&quot;src&quot;:&quot;https://cdn.radpro.id/uploads/logos/logo-landing-page.png&quot;",
    );
    expect(markup).not.toContain(
      "&quot;src&quot;:&quot;/uploads/logos/logo-aplikasi.png&quot;",
    );
  });

  it("falls back to client branding logo when SSR logo is unavailable", () => {
    mockUsePublicBranding.mockReturnValue({
      branding: {
        namaAplikasi: "SBLNET Public",
        appLogoUrl: "https://cdn.radpro.id/uploads/logos/logo-aplikasi.png",
      },
      loading: false,
      error: null,
    });

    const markup = renderToStaticMarkup(
      <LandingPage brandingName="SBLNET Public" brandingLogoUrl={undefined} />,
    );

    expect(markup).toContain(
      "&quot;src&quot;:&quot;https://cdn.radpro.id/uploads/logos/logo-aplikasi.png&quot;",
    );
    expect(markup).not.toContain(
      "&quot;src&quot;:&quot;/images/logo-sbl.png&quot;",
    );
  });
});
