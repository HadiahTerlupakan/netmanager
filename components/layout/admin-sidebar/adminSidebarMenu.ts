import type { MenuConfig } from "@/lib/menu-config";

type SidebarPermissionChecker = (permission: string) => boolean;

type FilterAdminMenuItemsParams = {
  items: MenuConfig[];
  hasPermission: SidebarPermissionChecker;
  pppConnectionMode?: string | null;
};

type SidebarPathCheckParams = {
  item: Pick<MenuConfig, "path" | "exact">;
  pathname: string;
};

const MIKROTIK_API_MODE = "MIKROTIK_API";
const INTEGRATION_MENU_CODE = "INTEGRATION";

/** Tujuan: memfilter menu admin sesuai permission dan mode koneksi PPP. */
export function filterAdminMenuItems({
  items,
  hasPermission,
  pppConnectionMode,
}: FilterAdminMenuItemsParams): MenuConfig[] {
  return items
    .map((item) =>
      filterAdminMenuItem({ item, hasPermission, pppConnectionMode }),
    )
    .filter((item): item is MenuConfig => item !== null);
}

/** Tujuan: menentukan status aktif item sidebar berdasarkan pathname saat ini. */
export function isSidebarItemActive({
  item,
  pathname,
}: SidebarPathCheckParams): boolean {
  const itemPath = item.path || "";

  if (!itemPath) {
    return false;
  }

  if (item.exact) {
    return pathname === itemPath;
  }

  return pathname === itemPath || pathname.startsWith(itemPath + "/");
}

/** Tujuan: menentukan apakah parent sidebar memiliki child yang aktif. */
export function hasActiveSidebarChild(
  children: MenuConfig[] | undefined,
  pathname: string,
): boolean {
  if (!children?.length) {
    return false;
  }

  return children.some((child) =>
    isSidebarItemActive({ item: child, pathname }),
  );
}

/** Tujuan: menghasilkan id konten collapsible sidebar yang stabil dan aksesibel. */
export function getSidebarSectionContentId(code: string): string {
  return `sidebar-section-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function filterAdminMenuItem({
  item,
  hasPermission,
  pppConnectionMode,
}: {
  item: MenuConfig;
  hasPermission: SidebarPermissionChecker;
  pppConnectionMode?: string | null;
}): MenuConfig | null {
  if (shouldHideRadiusMenu(item, pppConnectionMode)) {
    return null;
  }

  const filteredChildren = item.children
    ?.map((child) =>
      filterAdminMenuItem({
        item: child,
        hasPermission,
        pppConnectionMode,
      }),
    )
    .filter((child): child is MenuConfig => child !== null);

  if (shouldHideEmptyIntegrationMenu(item.code, filteredChildren)) {
    return null;
  }

  if (filteredChildren?.length) {
    return { ...item, children: filteredChildren };
  }

  if (!hasMenuPermission(item.code, hasPermission)) {
    return null;
  }

  return { ...item, children: filteredChildren };
}

function shouldHideRadiusMenu(
  item: MenuConfig,
  pppConnectionMode?: string | null,
): boolean {
  if (pppConnectionMode !== MIKROTIK_API_MODE) {
    return false;
  }

  return isRadiusMenu(item.code);
}

function isRadiusMenu(code: string): boolean {
  return (
    code === "NETWORK.RADIUS" ||
    code === "INTEGRATION.MIXRADIUS" ||
    code.startsWith("INTEGRATION.MIXRADIUS_")
  );
}

function shouldHideEmptyIntegrationMenu(
  code: string,
  children: MenuConfig[] | undefined,
): boolean {
  return code === INTEGRATION_MENU_CODE && (!children || children.length === 0);
}

function hasMenuPermission(
  code: string,
  hasPermission: SidebarPermissionChecker,
): boolean {
  const permissionResource = getPermissionResource(code);

  if (!permissionResource) {
    return true;
  }

  return hasPermission(`${permissionResource.toLowerCase()}:read`);
}

function getPermissionResource(code: string): string {
  if (!code) {
    return "";
  }

  // Special handling for ambiguous child codes that should inherit parent resource
  const specialMappings: Record<string, string> = {
    "MITRA.LIST": "mitra",
    "MITRA.WITHDRAWALS": "withdrawals",
    "INVESTORS.LIST": "investors",
  };

  if (specialMappings[code]) {
    return specialMappings[code];
  }

  if (!code.includes(".")) {
    return code;
  }

  return code.split(".").pop() ?? "";
}
