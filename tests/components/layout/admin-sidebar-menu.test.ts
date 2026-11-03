import { describe, expect, it } from "vitest";

import { ADMIN_MENU_CONFIG, type MenuConfig } from "@/lib/menu-config";
import {
  filterAdminMenuItems,
  getSidebarSectionContentId,
  hasActiveSidebarChild,
  isSidebarChildActive,
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

  it("menampilkan menu Pengeluaran dan Proyek bagi pemegang expense:read tanpa finance:read", () => {
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
      expect.objectContaining({
        code: "FINANCE.PROYEK",
        path: "/admin/proyek",
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

  it("menu Halaman Isolir tampil setelah Logo bagi pemegang isolir_page:read", () => {
    const pengaturan = ADMIN_MENU_CONFIG.filter(
      (item) => item.code === "PENGATURAN",
    );
    const visibleChildren = (permissions: string[]) =>
      filterAdminMenuItems({
        items: pengaturan,
        hasPermission: (permission) => permissions.includes(permission),
        isFeatureEnabled: () => true,
      })[0]?.children?.map((child) => child.code) ?? [];

    expect(visibleChildren(["logo:read", "isolir_page:read"])).toEqual([
      "PENGATURAN.LOGO",
      "PENGATURAN.HALAMAN_ISOLIR",
    ]);
    expect(visibleChildren(["logo:read"])).toEqual(["PENGATURAN.LOGO"]);
  });
});

describe("menu inventory Master Barang / Master Jasa (tab ?tab=jasa)", () => {
  const inventoryChildren =
    ADMIN_MENU_CONFIG.find((item) => item.code === "INVENTORY")?.children ?? [];
  const barangMenu = inventoryChildren.find(
    (child) => child.code === "INVENTORY.BARANG",
  ) as MenuConfig;
  const jasaMenu = inventoryChildren.find(
    (child) => child.code === "INVENTORY.JASA",
  ) as MenuConfig;

  function activeNames(pathname: string, search: string): string[] {
    return [barangMenu, jasaMenu]
      .filter((item) =>
        isSidebarChildActive({
          item,
          siblings: inventoryChildren,
          pathname,
          search,
        }),
      )
      .map((item) => item.name);
  }

  it("Master Jasa menunjuk ke tab jasa di halaman barang", () => {
    expect(jasaMenu.path).toBe("/admin/inventory/barang?tab=jasa");
  });

  it("hanya Master Jasa yang menyala di tab jasa", () => {
    expect(activeNames("/admin/inventory/barang", "tab=jasa")).toEqual([
      "Master Jasa",
    ]);
  });

  it("hanya Master Barang yang menyala di tab barang dan halaman turunannya", () => {
    expect(activeNames("/admin/inventory/barang", "")).toEqual([
      "Master Barang",
    ]);
    expect(activeNames("/admin/inventory/barang", "tab=barang")).toEqual([
      "Master Barang",
    ]);
    expect(activeNames("/admin/inventory/barang/new", "")).toEqual([
      "Master Barang",
    ]);
  });

  it("parent inventory tetap terbuka saat tab jasa aktif", () => {
    expect(
      hasActiveSidebarChild(inventoryChildren, "/admin/inventory/barang"),
    ).toBe(true);
  });
});
