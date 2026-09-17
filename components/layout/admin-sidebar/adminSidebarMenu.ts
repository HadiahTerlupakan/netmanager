import type { MenuConfig } from "@/lib/menu-config";

type SidebarPermissionChecker = (permission: string) => boolean;
type SidebarFeatureChecker = (feature: string) => boolean;

type FilterAdminMenuItemsParams = {
  items: MenuConfig[];
  hasPermission: SidebarPermissionChecker;
  pppConnectionMode?: string | null;
  /**
   * Status setting global Full RADIUS Mode. Bila `false`, semua menu yang
   * di-tag `requiresFullRadiusMode: true` akan disembunyikan (mis. modul
   * accel-ppp). Bila `undefined`, behavior fallback = item tetap muncul
   * supaya tidak menghilangkan menu di environment lama yang belum
   * mengirim flag ini.
   */
  fullRadiusMode?: boolean;
  isSuperAdmin?: boolean;
  /**
   * Cek apakah feature module aktif untuk tenant aktif. Default = always true
   * (jika undefined → tidak ada filter feature flag, behavior backward-compatible).
   * Lihat `lib/feature-modules.ts` dan `contexts/FeatureFlagsContext.tsx`.
   */
  isFeatureEnabled?: SidebarFeatureChecker;
};

type SidebarPathCheckParams = {
  item: Pick<MenuConfig, "path" | "exact">;
  pathname: string;
};

const MIKROTIK_API_MODE = "MIKROTIK_API";

/** Tujuan: memfilter menu admin sesuai permission, mode koneksi PPP, status super admin, dan feature flag tenant. */
export function filterAdminMenuItems({
  items,
  hasPermission,
  pppConnectionMode,
  fullRadiusMode,
  isSuperAdmin,
  isFeatureEnabled,
}: FilterAdminMenuItemsParams): MenuConfig[] {
  return items
    .map((item) =>
      filterAdminMenuItem({
        item,
        hasPermission,
        pppConnectionMode,
        fullRadiusMode,
        isSuperAdmin,
        isFeatureEnabled,
      }),
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
  fullRadiusMode,
  isSuperAdmin,
  isFeatureEnabled,
}: {
  item: MenuConfig;
  hasPermission: SidebarPermissionChecker;
  pppConnectionMode?: string | null;
  fullRadiusMode?: boolean;
  isSuperAdmin?: boolean;
  isFeatureEnabled?: SidebarFeatureChecker;
}): MenuConfig | null {
  if (item.superAdminOnly && !isSuperAdmin) {
    return null;
  }

  // Feature flag gate: super admin tetap lihat semua untuk keperluan
  // konfigurasi cross-tenant. Tenant biasa di-hide bila modul disable.
  if (
    !isSuperAdmin &&
    item.featureModule &&
    isFeatureEnabled &&
    !isFeatureEnabled(item.featureModule)
  ) {
    return null;
  }

  // Full RADIUS Mode gate: item yang di-tag `requiresFullRadiusMode` hanya
  // tampil saat toggle global aktif. Bila flag tidak diberikan (undefined),
  // item juga disembunyikan—sumber kebenaran adalah backend, bukan asumsi
  // implicit.
  if (item.requiresFullRadiusMode && !fullRadiusMode) {
    return null;
  }

  if (shouldHideRadiusMenu(item, pppConnectionMode)) {
    return null;
  }

  const filteredChildren = item.children
    ?.map((child) =>
      filterAdminMenuItem({
        item: child,
        hasPermission,
        pppConnectionMode,
        fullRadiusMode,
        isSuperAdmin,
        isFeatureEnabled,
      }),
    )
    .filter((child): child is MenuConfig => child !== null);

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
  return code === "NETWORK.RADIUS";
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
    "INVESTORS.DEPOSITS": "investors",
    "INVESTORS.PROFIT_SHARES": "investors",
    "ACCOUNTING.JOURNAL": "accounting",
    "ACCOUNTING.COA": "accounting",
    "ACCOUNTING.PERIOD": "accounting",
    "ACCOUNTING.RECONCILIATION": "accounting",
    "ACCOUNTING.REPORTS": "accounting",
    "TAX.DASHBOARD": "tax",
    "TAX.CONFIG": "tax",
    "TAX.TRANSACTIONS": "tax",
    "TAX.BHP_USO": "tax",
    "TAX.EXPORT": "tax",
    "OLT.DEVICES": "olt_devices",
    "OLT.ONU": "olt_onu",
    "OLT.UNREGISTERED": "olt_onu",
    "OLT.LOGS": "olt_logs",
    "OLT.BANDWIDTH": "olt_devices",
    "OLT.MONITORING": "olt",
    "OLT.ALERTS": "olt_logs",
    "SALARY.SALARY": "salary",
    "SALARY.PROFILES": "salary",
    "SALARY.COMPONENTS": "salary",
    "SALARY.CONFIG": "salary",
    // Procurement: child code "APPROVAL_THRESHOLDS" tidak punya permission
    // resource sendiri; gating-nya pakai permission group `procurement`
    // karena dianggap konfigurasi internal procurement.
    "PROCUREMENT.APPROVAL_THRESHOLDS": "procurement",
    "FINANCE.UNPAID": "finance",
    "FINANCE.ACCOUNTS": "finance",
    "FINANCE.MANUAL_PAYMENTS": "finance",
    "FINANCE.AR_AGING": "finance",
    "FINANCE.EXECUTIVE": "finance",
    "FINANCE.COHORT": "finance",
    "FINANCE.INCIDENTS": "finance",
    // HR menu: surface kepegawaian reuse permission users (fase 1 PRD)
    HR: "users",
    "HR.EMPLOYEES": "users",
    // Planning OSP: semua child reuse permission resource `planning`
    PLANNING: "planning",
    "PLANNING.DASHBOARD": "planning",
    "PLANNING.LIST": "planning",
    "PLANNING.KANBAN": "planning",
    "PLANNING.TEMPLATES": "planning",
  };

  if (specialMappings[code]) {
    return specialMappings[code];
  }

  if (!code.includes(".")) {
    return code;
  }

  return code.split(".").pop() ?? "";
}
