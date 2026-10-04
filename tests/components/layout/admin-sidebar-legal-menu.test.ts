import { describe, expect, it } from "vitest";

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import { filterAdminMenuItems } from "@/components/layout/admin-sidebar/adminSidebarMenu";

/**
 * Menu Legal menggabungkan modul legal dan surat pengesahan, yang izinnya
 * berbeda. Tiap submenu harus digerbang izinnya sendiri, dan mematikan modul
 * Legal untuk tenant tidak boleh ikut menyembunyikan Surat Pengesahan.
 */

const legalMenu = ADMIN_MENU_CONFIG.filter((item) => item.code === "LEGAL");

function visibleChildren(
  permissions: string[],
  isLegalEnabled = true,
): string[] | null {
  const [legal] = filterAdminMenuItems({
    items: legalMenu,
    hasPermission: (permission) => permissions.includes(permission),
    isFeatureEnabled: (feature) => feature !== "legal" || isLegalEnabled,
  });

  return legal ? (legal.children ?? []).map((child) => child.code) : null;
}

describe("menu Legal", () => {
  it("pemegang legal:read dan pengesahan:read melihat semua submenu", () => {
    expect(visibleChildren(["legal:read", "pengesahan:read"])).toEqual([
      "LEGAL.DASHBOARD",
      "LEGAL.DOKUMEN",
      "LEGAL.TEMPLATE",
      "LEGAL.PENGESAHAN",
      "LEGAL.KATEGORI",
    ]);
  });

  it("hanya pengesahan:read: menu Legal tampil berisi Surat Pengesahan saja", () => {
    expect(visibleChildren(["pengesahan:read"])).toEqual(["LEGAL.PENGESAHAN"]);
  });

  it("hanya legal:read: tanpa Surat Pengesahan", () => {
    expect(visibleChildren(["legal:read"])).toEqual([
      "LEGAL.DASHBOARD",
      "LEGAL.DOKUMEN",
      "LEGAL.TEMPLATE",
      "LEGAL.KATEGORI",
    ]);
  });

  it("modul Legal dimatikan untuk tenant: Surat Pengesahan tetap ada", () => {
    expect(visibleChildren(["legal:read", "pengesahan:read"], false)).toEqual([
      "LEGAL.PENGESAHAN",
    ]);
  });

  it("tanpa izin keduanya: menu Legal tidak tampil", () => {
    expect(visibleChildren(["users:read"])).toBeNull();
  });

  it("menu Surat Pengesahan tidak lagi berdiri sendiri di luar Legal", () => {
    expect(ADMIN_MENU_CONFIG.some((item) => item.code === "PENGESAHAN")).toBe(false);
  });
});
