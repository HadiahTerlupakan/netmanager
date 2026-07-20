import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import { filterAdminMenuItems } from "@/components/layout/admin-sidebar/adminSidebarMenu";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("HR menu config (PRD-HR-MENU-SPLIT v2)", () => {
  it("punya parent HR dengan child Data Pegawai", () => {
    const hr = ADMIN_MENU_CONFIG.find((item) => item.code === "HR");
    expect(hr).toBeDefined();
    expect(hr?.name).toBe("HR");
    expect(hr?.path).toBe("/admin/hr");
    expect(hr?.featureModule).toBeUndefined();
    expect(hr?.section).toBe("SDM");

    const employees = hr?.children?.find((c) => c.code === "HR.EMPLOYEES");
    expect(employees).toBeDefined();
    expect(employees?.path).toBe("/admin/hr/employees");
    expect(employees?.featureModule).toBe("users");
  });

  it("USERS tetap top-level dengan path /admin/users", () => {
    const users = ADMIN_MENU_CONFIG.find((item) => item.code === "USERS");
    expect(users).toBeDefined();
    expect(users?.path).toBe("/admin/users");
    expect(users?.name).toBe("Pengguna");
  });

  it("Kehadiran dan Penggajian tetap top-level (bukan child HR)", () => {
    const hr = ADMIN_MENU_CONFIG.find((item) => item.code === "HR");
    const hrChildCodes = (hr?.children ?? []).map((c) => c.code);
    expect(hrChildCodes).not.toContain("KEHADIRAN");
    expect(hrChildCodes).not.toContain("SALARY");

    expect(ADMIN_MENU_CONFIG.some((i) => i.code === "KEHADIRAN")).toBe(true);
    expect(ADMIN_MENU_CONFIG.some((i) => i.code === "SALARY")).toBe(true);
  });

  it("filter menu: users:read menampilkan HR.EMPLOYEES", () => {
    const filtered = filterAdminMenuItems({
      items: ADMIN_MENU_CONFIG,
      hasPermission: (permission) => permission === "users:read",
      isFeatureEnabled: () => true,
    });
    const hr = filtered.find((item) => item.code === "HR");
    expect(hr).toBeDefined();
    expect(hr?.children?.some((c) => c.code === "HR.EMPLOYEES")).toBe(true);
  });

  it("filter menu: tanpa users:read menyembunyikan Data Pegawai", () => {
    const filtered = filterAdminMenuItems({
      items: ADMIN_MENU_CONFIG,
      hasPermission: (permission) => permission === "salary:read",
      isFeatureEnabled: () => true,
    });
    const hr = filtered.find((item) => item.code === "HR");
    // parent HR hilang jika tidak ada child lolos, atau child kosong
    const hasEmployees = hr?.children?.some((c) => c.code === "HR.EMPLOYEES");
    expect(hasEmployees).toBeFalsy();
  });

  it("specialMappings memetakan HR dan HR.EMPLOYEES ke users", () => {
    const source = readSource(
      "components/layout/admin-sidebar/adminSidebarMenu.ts",
    );
    // prettier unquotes valid identifier keys, jadi terima "HR" atau HR
    expect(source).toMatch(/"?HR"?\s*:\s*"users"/);
    expect(source).toMatch(/"HR\.EMPLOYEES"\s*:\s*"users"/);
  });
});
