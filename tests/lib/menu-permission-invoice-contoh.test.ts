import { describe, expect, it } from "vitest";
import { filterAdminMenuItems } from "@/components/layout/admin-sidebar/adminSidebarMenu";
import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import { PERMISSION_GROUPS } from "@/lib/permission-config";
import { RESOURCE_CAPABILITIES } from "@/lib/resource-capabilities";

const findItem = (items: typeof ADMIN_MENU_CONFIG, code: string) =>
  items
    .flatMap((item) => [item, ...(item.children ?? [])])
    .find((item) => item.code === code);

describe("menu Invoice Contoh", () => {
  it("sits under Finance with the pinned path", () => {
    expect(
      findItem(ADMIN_MENU_CONFIG, "FINANCE.SAMPLE_INVOICES"),
    ).toMatchObject({
      name: "Invoice Contoh",
      path: "/admin/finance/invoice-contoh",
    });
  });

  it("is visible only with invoice_contoh:read", () => {
    const visible = (permissions: string[]) =>
      findItem(
        filterAdminMenuItems({
          items: ADMIN_MENU_CONFIG,
          hasPermission: (permission: string) =>
            permissions.includes(permission) || permission === "finance:read",
          pppConnectionMode: "pppoe",
          fullRadiusMode: false,
          isSuperAdmin: false,
          isFeatureEnabled: () => true,
        } as never),
        "FINANCE.SAMPLE_INVOICES",
      );

    expect(visible(["invoice_contoh:read"])).toBeDefined();
    expect(visible([])).toBeUndefined();
  });

  it("has its own permission resource in the Finance group", () => {
    expect(PERMISSION_GROUPS.FINANCE).toContain("invoice_contoh");
    expect(RESOURCE_CAPABILITIES.invoice_contoh?.actions).toEqual([
      "read",
      "create",
      "update",
      "delete",
    ]);
  });
});
