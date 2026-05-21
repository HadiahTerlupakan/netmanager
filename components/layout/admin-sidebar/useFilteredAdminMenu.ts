import { useMemo } from "react";

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import { filterAdminMenuItems } from "./adminSidebarMenu";

type UseFilteredAdminMenuParams = {
  hasPermission: (permission: string) => boolean;
  pppConnectionMode?: string | null;
  isSuperAdmin?: boolean;
};

/** Tujuan: menyediakan menu sidebar admin yang sudah difilter sesuai konteks user. */
export function useFilteredAdminMenu({
  hasPermission,
  pppConnectionMode,
  isSuperAdmin,
}: UseFilteredAdminMenuParams) {
  return useMemo(
    () =>
      filterAdminMenuItems({
        items: ADMIN_MENU_CONFIG,
        hasPermission,
        pppConnectionMode,
        isSuperAdmin,
      }),
    [hasPermission, pppConnectionMode, isSuperAdmin],
  );
}
