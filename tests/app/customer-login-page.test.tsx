import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  push: vi.fn(),
  login: vi.fn(),
  usePublicBranding: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockFns.push }),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { alt, ...rest } = props;
    return `<img alt="${String(alt)}" />${JSON.stringify(rest)}`;
  },
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock("@/components/customer/CustomerAuthProvider", () => ({
  useCustomerAuth: () => ({ login: mockFns.login }),
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    className,
    type = "button",
    disabled,
  }: {
    children?: ReactNode;
    className?: string;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }) => (
    <button className={className} type={type} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/hooks/usePublicBranding", () => ({
  DEFAULT_PUBLIC_APP_NAME: "NetManager",
  DEFAULT_PUBLIC_APP_LOGO_URL: "/images/logo-sbl.png",
  usePublicBranding: () => mockFns.usePublicBranding(),
}));

import CustomerLoginPage from "@/app/(customer)/login/page";

describe("CustomerLoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders logo skeleton instead of fallback logo while public branding is still loading", () => {
    mockFns.usePublicBranding.mockReturnValue({
      branding: null,
      loading: true,
    });

    const markup = renderToStaticMarkup(<CustomerLoginPage />);

    expect(markup).toContain('data-testid="customer-login-logo-skeleton"');
    expect(markup).not.toContain(
      "&quot;src&quot;:&quot;/images/logo-sbl.png&quot;",
    );
    expect(markup).not.toContain("&quot;sizes&quot;:&quot;320px&quot;");
  });

  it("adds sizes for default public logo image", () => {
    mockFns.usePublicBranding.mockReturnValue({
      branding: null,
      loading: false,
    });

    const markup = renderToStaticMarkup(<CustomerLoginPage />);

    expect(markup).toContain(
      "&quot;src&quot;:&quot;/images/logo-sbl.png&quot;",
    );
    expect(markup).toContain("&quot;sizes&quot;:&quot;320px&quot;");
  });

  it("adds sizes for remote branding logo image", () => {
    mockFns.usePublicBranding.mockReturnValue({
      branding: {
        namaAplikasi: "Tenant Demo",
        appLogoUrl:
          "https://cdn.radpro.id/uploads/logos/1776751579231-logo-aplikasi.png",
      },
      loading: false,
    });

    const markup = renderToStaticMarkup(<CustomerLoginPage />);

    expect(markup).toContain(
      "&quot;src&quot;:&quot;https://cdn.radpro.id/uploads/logos/1776751579231-logo-aplikasi.png&quot;",
    );
    expect(markup).toContain("&quot;sizes&quot;:&quot;320px&quot;");
  });
});
