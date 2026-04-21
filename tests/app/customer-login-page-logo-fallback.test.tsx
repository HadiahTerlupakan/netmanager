// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  push: vi.fn(),
  login: vi.fn(),
  usePublicBranding: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockFns.push }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) =>
    React.createElement("img", {
      ...props,
      alt: props.alt ?? "",
    }),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children?: React.ReactNode }) => children,
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
    onClick,
  }: {
    children?: React.ReactNode;
    className?: string;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button
      className={className}
      type={type}
      disabled={disabled}
      onClick={onClick}
    >
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

describe("CustomerLoginPage logo fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("falls back to default logo when branding logo fails to load", async () => {
    mockFns.usePublicBranding.mockReturnValue({
      branding: {
        namaAplikasi: "Tenant Demo",
        appLogoUrl: "https://cdn.radpro.id/uploads/logos/logo-aplikasi.png",
      },
      loading: false,
    });

    const container = document.createElement("div");
    document.body.appendChild(container);

    await act(async () => {
      createRoot(container).render(<CustomerLoginPage />);
      await Promise.resolve();
    });

    const logo = container.querySelector('img[alt="Logo Tenant Demo"]');

    expect(logo?.getAttribute("src")).toBe(
      "https://cdn.radpro.id/uploads/logos/logo-aplikasi.png",
    );

    await act(async () => {
      logo?.dispatchEvent(new Event("error", { bubbles: true }));
      await Promise.resolve();
    });

    expect(logo?.getAttribute("src")).toBe("/images/logo-sbl.png");
  });
});
