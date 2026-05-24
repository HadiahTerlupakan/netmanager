import { useMemo } from "react";

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import { filterAdminMenuItems } from "./adminSidebarMenu";

type UseFilteredAdminMenuParams = {
  hasPermission: (permission: string) => boolean;
  pppConnectionMode?: string | null;
  fullRadiusMode?: boolean;
  isSuperAdmin?: boolean;
  isFeatureEnabled?: (feature: string) => boolean;
};

/** Tujuan: menyediakan menu sidebar admin yang sudah difilter sesuai konteks user. */
export function useFilteredAdminMenu({
  hasPermission,
  pppConnectionMode,
  fullRadiusMode,
  isSuperAdmin,
  isFeatureEnabled,
}: UseFilteredAdminMenuParams) {
  return useMemo(
    () =>
      filterAdminMenuItems({
        items: ADMIN_MENU_CONFIG,
        hasPermission,
        pppConnectionMode,
        fullRadiusMode,
        isSuperAdmin,
        isFeatureEnabled,
      }),
    [
      hasPermission,
      pppConnectionMode,
      fullRadiusMode,
      isSuperAdmin,
      isFeatureEnabled,
    ],
  );
}
