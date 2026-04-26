// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  DEFAULT_PUBLIC_APP_NAME: "NetManager",
  DEFAULT_PUBLIC_APP_LOGO_URL: "/images/logo-sbl.png",
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
    >
      BRAND_LOGO
    </div>
  ),
}));

import Sidebar from "@/components/layout/Sidebar";
import EmployeeSidebar from "@/components/layout/EmployeeSidebar";

function setDesktopViewport() {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 1280,
  });
}

function setMobileViewport() {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: 375,
  });
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

function SidebarRenderHarness({ rerenderTick }: { rerenderTick?: number }) {
  return (
    <div data-rerender-tick={rerenderTick ?? 0}>
      <Sidebar />
    </div>
  );
}

async function renderSidebar(root: Root, rerenderTick = 0) {
  await act(async () => {
    root.render(<SidebarRenderHarness rerenderTick={rerenderTick} />);
    await Promise.resolve();
  });
}

describe("sidebar tenant branding", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    setDesktopViewport();
    vi.clearAllMocks();
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

  it("centers the admin sidebar branding block with logo above the app name", () => {
    const markup = renderToStaticMarkup(<Sidebar />);

    expect(markup).toContain(
      "relative z-10 flex flex-col items-center justify-center gap-3",
    );
    expect(markup).toContain("text-center");
    expect(markup).toContain(
      'BRAND_LOGO</div><div class="flex flex-col items-center overflow-hidden text-center"',
    );
  });

  it("passes tenant-aware appLogoUrl to employee sidebar branding logo", () => {
    const markup = renderToStaticMarkup(<EmployeeSidebar />);

    expect(markup).toContain('data-app-name="Tenant App"');
    expect(markup).toContain('data-logo-url="/tenant-logo.png"');
  });

  it("centers the employee sidebar branding block with logo above the app name", () => {
    const markup = renderToStaticMarkup(<EmployeeSidebar />);

    expect(markup).toContain(
      "relative z-10 flex flex-col items-center justify-center gap-3",
    );
    expect(markup).toContain("text-center");
    expect(markup).toContain(
      'BRAND_LOGO</div><div class="flex flex-col items-center overflow-hidden text-center"',
    );
  });

  it("does not fall back to default public logo while tenant branding is still loading", () => {
    mockUseSettings.mockReturnValue({
      settings: {
        namaAplikasi: "Tenant App",
        logoAplikasi: "/tenant-logo.png",
      },
      loading: false,
    });

    mockUsePublicBranding.mockReturnValue({
      branding: null,
      loading: true,
      error: null,
    });

    const markup = renderToStaticMarkup(<Sidebar />);

    expect(markup).toContain('data-app-name="Tenant App"');
    expect(markup).toContain('data-logo-url="/tenant-logo.png"');
    expect(markup).not.toContain('data-logo-url="/images/logo-sbl.png"');
  });

  it("adds modal semantics, focus management, and keyboard support for the mobile admin drawer", async () => {
    setMobileViewport();
    const container = document.createElement("div");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "Open sidebar";
    document.body.append(trigger, container);
    trigger.focus();

    const root = createRoot(container);

    await renderSidebar(root);

    const toggleSidebar = (
      window as Window & { toggleAdminSidebar?: () => void }
    ).toggleAdminSidebar;

    expect(toggleSidebar).toBeTypeOf("function");

    await act(async () => {
      toggleSidebar?.();
      await Promise.resolve();
    });

    const sidebar = document.querySelector("aside") as HTMLElement | null;
    const overlay = Array.from(document.querySelectorAll("div")).find(
      (element) => element.className.includes("bg-gray-900/60"),
    ) as HTMLElement | undefined;
    const closeButton = document.querySelector(
      'button[aria-label="Close menu"]',
    ) as HTMLButtonElement | null;
    const logoutButton = document.querySelector(
      'button[aria-label="Keluar dari akun"]',
    ) as HTMLButtonElement | null;

    expect(sidebar?.getAttribute("role")).toBe("dialog");
    expect(sidebar?.getAttribute("aria-modal")).toBe("true");
    expect(overlay?.getAttribute("aria-hidden")).toBe("true");
    expect(document.activeElement).toBe(closeButton);

    logoutButton?.focus();
    logoutButton?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(document.activeElement).toBe(closeButton);

    closeButton?.focus();
    closeButton?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        shiftKey: true,
      }),
    );
    expect(document.activeElement).toBe(logoutButton);

    const focusableElements = sidebar ? getFocusableElements(sidebar) : [];
    expect(focusableElements.length).toBeGreaterThan(1);

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await Promise.resolve();
    });

    const closedOverlay = Array.from(document.querySelectorAll("div")).find(
      (element) => element.className.includes("bg-gray-900/60"),
    );

    expect(closedOverlay).toBeUndefined();
    expect(document.activeElement).toBe(trigger);
    expect(sidebar?.getAttribute("role")).toBeNull();
    expect(sidebar?.getAttribute("aria-modal")).toBeNull();
  });

  it("restores focus to the original trigger after rerendering while the mobile drawer remains open", async () => {
    setMobileViewport();
    const container = document.createElement("div");
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "Open sidebar";
    document.body.append(trigger, container);
    trigger.focus();

    const root = createRoot(container);

    await renderSidebar(root);

    const toggleSidebar = (
      window as Window & { toggleAdminSidebar?: () => void }
    ).toggleAdminSidebar;

    await act(async () => {
      toggleSidebar?.();
      await Promise.resolve();
    });

    const closeButton = document.querySelector(
      'button[aria-label="Close menu"]',
    ) as HTMLButtonElement | null;
    expect(document.activeElement).toBe(closeButton);

    const logoutButton = document.querySelector(
      'button[aria-label="Keluar dari akun"]',
    ) as HTMLButtonElement | null;
    logoutButton?.focus();
    expect(document.activeElement).toBe(logoutButton);

    await renderSidebar(root, 1);
    expect(document.activeElement).toBe(logoutButton);

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(trigger);
  });
});
