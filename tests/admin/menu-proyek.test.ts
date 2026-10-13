import { describe, expect, it } from "vitest";

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import { filterAdminMenuItems } from "@/components/layout/admin-sidebar/adminSidebarMenu";

const findMenuByCode = (code: string) =>
  ADMIN_MENU_CONFIG.flatMap((item) => [item, ...(item.children ?? [])]).find(
    (item) => item.code === code,
  );

describe("menu Proyek (RAB)", () => {
  it("terdaftar dan menunjuk /admin/proyek", () => {
    const menu = findMenuByCode("FINANCE.PROYEK");

    expect(menu).toBeDefined();
    expect(menu?.path).toBe("/admin/proyek");
  });

  it("terlihat oleh role yang hanya punya izin expense:read", () => {
    const codes = filterAdminMenuItems({
      items: ADMIN_MENU_CONFIG,
      hasPermission: (permission) => permission === "expense:read",
      isSuperAdmin: false,
      isFeatureEnabled: (feature) => feature === "finance",
    })
      .find((item) => item.code === "FINANCE")
      ?.children?.map((anak) => anak.code);

    expect(codes).toContain("FINANCE.PROYEK");
  });
});
