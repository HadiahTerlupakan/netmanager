import { describe, expect, it } from "vitest";
import { renderAdminSidebarIcon } from "@/components/layout/admin-sidebar/adminSidebarIcons";
import { ADMIN_MENU_CONFIG, type MenuConfig } from "@/lib/menu-config";

function collectIcons(items: MenuConfig[]): Array<[string, string]> {
  return items.flatMap((item) => [
    ...(item.icon ? [[item.code, item.icon] as [string, string]] : []),
    ...collectIcons(item.children ?? []),
  ]);
}

describe("ikon menu admin", () => {
  it.each(collectIcons(ADMIN_MENU_CONFIG))("%s memakai ikon yang terdaftar (%s)", (_code, icon) => {
    expect(renderAdminSidebarIcon(icon, "h-5 w-5")).not.toBeNull();
  });
});
