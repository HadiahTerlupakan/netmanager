import { describe, expect, it } from "vitest";

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import { filterAdminMenuItems } from "@/components/layout/admin-sidebar/adminSidebarMenu";

/**
 * Komdigi menerbitkan formulir berbeda untuk ISP dan Jartaplok PS, dan satu
 * tenant bisa memegang kedua izin. Menu Self-Assessment karena itu berupa induk
 * dengan satu submenu per jenis izin — bukan dua menu sejajar, dan bukan satu
 * menu yang isinya bergantung tebakan.
 */

const regulasiMenu = ADMIN_MENU_CONFIG.filter(
  (item) => item.code === "REGULASI",
);

function submenuTampil(permissions: string[]): string[] | null {
  const [regulasi] = filterAdminMenuItems({
    items: regulasiMenu,
    hasPermission: (permission: string) => permissions.includes(permission),
    isFeatureEnabled: () => true,
  });

  return regulasi
    ? (regulasi.children ?? []).map((child: { code: string }) => child.code)
    : null;
}

describe("menu Self-Assessment", () => {
  it("berupa satu induk, bukan dua menu sejajar", () => {
    expect(regulasiMenu).toHaveLength(1);
    expect(regulasiMenu[0].name).toBe("Self-Assessment");
  });

  it("memuat submenu ISP dan Jartaplok PS", () => {
    expect(submenuTampil(["regulasi:read"])).toEqual([
      "REGULASI.ISP",
      "REGULASI.JARTAPLOK_PS",
    ]);
  });

  it("submenu menunjuk halaman per jenis izin", () => {
    const anak = regulasiMenu[0].children ?? [];
    expect(anak.map((child) => child.path)).toEqual([
      "/admin/regulasi/self-assessment/isp",
      "/admin/regulasi/self-assessment/jartaplok-ps",
    ]);
  });

  it("tanpa izin regulasi, menu tidak tampil sama sekali", () => {
    expect(submenuTampil([])).toBeNull();
  });
});
