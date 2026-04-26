import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AdminSidebarNav } from "@/components/layout/admin-sidebar/AdminSidebarNav";
import type { MenuConfig } from "@/lib/menu-config";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const parentItem: MenuConfig = {
  code: "SYSTEM.LOG",
  name: "System Log",
  path: "/admin/system",
  icon: "document-report",
  children: [
    {
      code: "SYSTEM.LOG.LOGIN",
      name: "Log Login",
      path: "/admin/system/log-login",
      icon: "shield-check",
    },
  ],
};

describe("AdminSidebarNav", () => {
  it("does not render child links when submenu is collapsed", () => {
    const markup = renderToStaticMarkup(
      <AdminSidebarNav
        items={[parentItem]}
        pathname="/admin/dashboard"
        isMenuExpanded={() => false}
        onToggleMenu={() => {}}
      />,
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain("/admin/system/log-login");
    expect(markup).not.toContain("Log Login");
  });

  it("renders child links when submenu is expanded", () => {
    const markup = renderToStaticMarkup(
      <AdminSidebarNav
        items={[parentItem]}
        pathname="/admin/system/log-login"
        isMenuExpanded={() => true}
        onToggleMenu={() => {}}
      />,
    );

    expect(markup).toContain('aria-hidden="false"');
    expect(markup).toContain("/admin/system/log-login");
    expect(markup).toContain("Log Login");
  });
});
