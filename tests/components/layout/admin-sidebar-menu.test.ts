import { describe, expect, it } from "vitest";

import type { MenuConfig } from "@/lib/menu-config";
import {
  filterAdminMenuItems,
  getSidebarSectionContentId,
  isSidebarItemActive,
} from "@/components/layout/admin-sidebar/adminSidebarMenu";

const SAMPLE_MENU: MenuConfig[] = [
  {
    code: "NETWORK",
    name: "Network",
    path: "/admin/network",
    children: [
      {
        code: "NETWORK.MIKROTIK",
        name: "MikroTik",
        path: "/admin/network/mikrotik",
      },
      {
        code: "NETWORK.RADIUS",
        name: "RADIUS",
        path: "/admin/network/radius",
      },
    ],
  },
  {
    code: "INTEGRATION",
    name: "Integrasi",
    path: "/admin/integrations",
    children: [
      {
        code: "INTEGRATION.MIXRADIUS",
        name: "MixRadius",
        path: "/admin/integrations/mixradius",
      },
      {
        code: "INTEGRATION.MIXRADIUS_SITES",
        name: "Sites",
        path: "/admin/integrations/mixradius/groups",
      },
    ],
  },
];

describe("adminSidebarMenu", () => {
  it("menyembunyikan menu radius saat mode PPP memakai MikroTik API", () => {
    const filteredMenus = filterAdminMenuItems({
      items: SAMPLE_MENU,
      pppConnectionMode: "MIKROTIK_API",
      hasPermission: () => true,
    });

    expect(filteredMenus).toEqual([
      {
        code: "NETWORK",
        name: "Network",
        path: "/admin/network",
        children: [
          {
            code: "NETWORK.MIKROTIK",
            name: "MikroTik",
            path: "/admin/network/mikrotik",
          },
        ],
      },
    ]);
  });

  it("tetap menampilkan parent ketika child punya permission baca", () => {
    const filteredMenus = filterAdminMenuItems({
      items: [SAMPLE_MENU[0]],
      pppConnectionMode: "RADIUS",
      hasPermission: (permission) => permission === "mikrotik:read",
    });

    expect(filteredMenus).toEqual([
      {
        code: "NETWORK",
        name: "Network",
        path: "/admin/network",
        children: [
          {
            code: "NETWORK.MIKROTIK",
            name: "MikroTik",
            path: "/admin/network/mikrotik",
          },
        ],
      },
    ]);
  });

  it("membuat id collapsible yang stabil dari kode menu", () => {
    expect(getSidebarSectionContentId("SYSTEM_LOG.LOGIN")).toBe(
      "sidebar-section-system-log-login",
    );
  });

  it("mendeteksi item aktif untuk exact dan nested path", () => {
    expect(
      isSidebarItemActive({
        item: { path: "/admin", exact: true },
        pathname: "/admin/users",
      }),
    ).toBe(false);

    expect(
      isSidebarItemActive({
        item: { path: "/admin/users" },
        pathname: "/admin/users/123",
      }),
    ).toBe(true);
  });
});
