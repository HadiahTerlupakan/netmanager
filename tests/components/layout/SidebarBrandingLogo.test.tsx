import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SidebarBrandingLogo } from "@/components/layout/SidebarBrandingLogo";

describe("SidebarBrandingLogo", () => {
  it("renders tenant logo larger without adding rounded frame styling", () => {
    const markup = renderToStaticMarkup(
      <SidebarBrandingLogo appName="NetManager" logoUrl="/uploads/logo.png" />,
    );

    expect(markup).toContain("relative h-24 w-24 shrink-0");
    expect(markup).not.toContain("rounded-xl");
    expect(markup).not.toContain("ring-1");
    expect(markup).not.toContain("overflow-hidden");
    expect(markup).toContain("<img");
    expect(markup).toContain('alt="NetManager logo"');
    expect(markup).toContain("/_next/image?url=%2Fuploads%2Flogo.png");
    expect(markup).toContain('data-nimg="fill"');
    expect(markup).toContain("object-contain");
    expect(markup).toContain('sizes="96px"');
  });

  it("renders monogram fallback when logoUrl is empty", () => {
    const markup = renderToStaticMarkup(
      <SidebarBrandingLogo appName="NetManager" logoUrl={null} />,
    );

    expect(markup).not.toContain("<img");
    expect(markup).toContain(">N<");
  });
});
