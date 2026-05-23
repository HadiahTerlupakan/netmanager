import { useMemo } from "react";

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import { filterAdminMenuItems } from "./adminSidebarMenu";

type UseFilteredAdminMenuParams = {
  hasPermission: (permission: string) => boolean;
  pppConnectionMode?: string | null;
  isSuperAdmin?: boolean;
  isFeatureEnabled?: (feature: string) => boolean;
};

/** Tujuan: menyediakan menu sidebar admin yang sudah difilter sesuai konteks user. */
export function useFilteredAdminMenu({
  hasPermission,
  pppConnectionMode,
  isSuperAdmin,
  isFeatureEnabled,
}: UseFilteredAdminMenuParams) {
  return useMemo(
    () =>
      filterAdminMenuItems({
        items: ADMIN_MENU_CONFIG,
        hasPermission,
        pppConnectionMode,
        isSuperAdmin,
        isFeatureEnabled,
      }),
    [hasPermission, pppConnectionMode, isSuperAdmin, isFeatureEnabled],
  );
}
