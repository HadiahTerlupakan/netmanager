import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSettings = vi.fn();
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

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/dashboard",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: {
        tenantName: "Tenant A",
        role: "SUPER_ADMIN",
      },
    },
  }),
  signOut: vi.fn(),
}));

vi.mock("@/hooks/use-permission", () => ({
  usePermission: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => mockUseSettings(),
}));

vi.mock("@/hooks/usePublicBranding", () => ({
  usePublicBranding: () => mockUsePublicBranding(),
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/lib/menu-config", () => ({
  ADMIN_MENU_CONFIG: [],
  EMPLOYEE_MENU_CONFIG: [],
}));

vi.mock("@/components/layout/SidebarBrandingLogo", () => ({
  SidebarBrandingLogo: ({
    appName,
    logoUrl,
  }: {
    appName: string;
    logoUrl?: string | null;
  }) => (
    <div
      data-testid="sidebar-branding-logo"
      data-app-name={appName}
      data-logo-url={logoUrl ?? ""}
    />
  ),
}));

import Sidebar from "@/components/layout/Sidebar";
import EmployeeSidebar from "@/components/layout/EmployeeSidebar";

describe("sidebar tenant branding", () => {
  beforeEach(() => {
    mockUseSettings.mockReturnValue({
      settings: {
        namaAplikasi: "Legacy App",
        logoAplikasi: "/legacy-logo.png",
      },
      loading: false,
    });

    mockUsePublicBranding.mockReturnValue({
      branding: {
        namaAplikasi: "Tenant App",
        appLogoUrl: "/tenant-logo.png",
      },
      loading: false,
      error: null,
    });
  });

  it("passes tenant-aware appLogoUrl to admin sidebar branding logo", () => {
    const markup = renderToStaticMarkup(<Sidebar />);

    expect(markup).toContain('data-app-name="Tenant App"');
    expect(markup).toContain('data-logo-url="/tenant-logo.png"');
  });

  it("passes tenant-aware appLogoUrl to employee sidebar branding logo", () => {
    const markup = renderToStaticMarkup(<EmployeeSidebar />);

    expect(markup).toContain('data-app-name="Tenant App"');
    expect(markup).toContain('data-logo-url="/tenant-logo.png"');
  });
});
