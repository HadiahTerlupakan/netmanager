import type { MenuConfig } from "./menu-config";

/**
 * Flatten menu config untuk list semua menu (parent + children)
 */
export function flattenMenuConfig(menus: MenuConfig[]): MenuConfig[] {
  const result: MenuConfig[] = [];
  for (const menu of menus) {
    result.push(menu);
    if (menu.children && menu.children.length > 0) {
      result.push(...flattenMenuConfig(menu.children));
    }
  }
  return result;
}

/**
 * Get all menu codes
 */
export function getAllMenuCodes(menus: MenuConfig[]): string[] {
  return flattenMenuConfig(menus).map((m) => m.code);
}

/**
 * Convert MenuConfig to format expected by PermissionMatrixEditor
 */
export function toPermissionMenuFormat(menus: MenuConfig[]) {
  return menus.map((menu) => ({
    id: menu.code,
    code: menu.code,
    name: menu.name,
    parentCode: null as string | null,
    path: menu.path,
    icon: (menu.icon || null) as string | null,
    sortOrder: 0,
    portal: "admin",
    children: menu.children?.map((child) => ({
      id: child.code,
      code: child.code,
      name: child.name,
      parentCode: menu.code as string | null,
      path: child.path,
      icon: (child.icon || null) as string | null,
      sortOrder: 0,
      portal: "admin",
    })),
  }));
}
