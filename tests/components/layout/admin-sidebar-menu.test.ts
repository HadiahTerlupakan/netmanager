import { describe, expect, it } from "vitest";

import { ADMIN_MENU_CONFIG, type MenuConfig } from "@/lib/menu-config";
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

  it("menampilkan menu Pengeluaran bagi pemegang expense:read tanpa finance:read", () => {
    const financeMenu = ADMIN_MENU_CONFIG.find(
      (item) => item.code === "FINANCE",
    );

    const filteredMenus = filterAdminMenuItems({
      items: financeMenu ? [financeMenu] : [],
      hasPermission: (permission) => permission === "expense:read",
    });

    expect(filteredMenus).toHaveLength(1);
    expect(filteredMenus[0].children).toEqual([
      expect.objectContaining({
        code: "FINANCE.EXPENSE",
        path: "/admin/pengeluaran",
      }),
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
