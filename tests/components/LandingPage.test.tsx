import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { alt, ...rest } = props;
    return `<img alt="${String(alt)}" />${JSON.stringify(rest)}`;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({ children }: { children: unknown }) => children,
}));

import LandingPage from "@/components/LandingPage";

describe("LandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with provided branding name and logo", () => {
    const markup = renderToStaticMarkup(
      <LandingPage
        brandingName="SBLNET Public"
        brandingLogoUrl="https://cdn.radpro.id/uploads/logos/logo-landing-page.png"
      />,
    );

    expect(markup).toContain("SBLNET Public");
    expect(markup).toContain(
      "&quot;src&quot;:&quot;https://cdn.radpro.id/uploads/logos/logo-landing-page.png&quot;",
    );
  });

  it("falls back to default logo when landing logo is unavailable", () => {
    const markup = renderToStaticMarkup(
      <LandingPage brandingName="SBLNET Public" brandingLogoUrl={undefined} />,
    );

    expect(markup).toContain("SBLNET Public");
    expect(markup).toContain(
      "&quot;src&quot;:&quot;/images/logo-sbl.png&quot;",
    );
  });

  it("renders all expected sections", () => {
    const markup = renderToStaticMarkup(
      <LandingPage brandingName="SBLNET Public" brandingLogoUrl={undefined} />,
    );

    expect(markup).toContain("Internet");
    expect(markup).toContain("Ngebut");
    expect(markup).toContain("Gbps");
    expect(markup).toContain("Koneksi Hyper-Speed");
    expect(markup).toContain("Anti Badai");
    expect(markup).toContain("Layanan CS 24/7");
    expect(markup).toContain("Hubungi Kami");
  });
});
