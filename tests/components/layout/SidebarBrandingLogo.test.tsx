import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SidebarBrandingLogo } from "@/components/layout/SidebarBrandingLogo";

describe("SidebarBrandingLogo", () => {
  it("renders optimized logo image when logoUrl is provided", () => {
    const markup = renderToStaticMarkup(
      <SidebarBrandingLogo appName="NetManager" logoUrl="/uploads/logo.png" />,
    );

    expect(markup).toContain("<img");
    expect(markup).toContain('alt="NetManager logo"');
    expect(markup).toContain("/_next/image?url=%2Fuploads%2Flogo.png");
    expect(markup).toContain('data-nimg="fill"');
  });

  it("renders monogram fallback when logoUrl is empty", () => {
    const markup = renderToStaticMarkup(
      <SidebarBrandingLogo appName="NetManager" logoUrl={null} />,
    );

    expect(markup).not.toContain("<img");
    expect(markup).toContain(">N<");
  });
});
