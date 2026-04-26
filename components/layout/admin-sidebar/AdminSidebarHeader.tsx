import type { RefObject } from "react";

import { SidebarBrandingLogo } from "@/components/layout/SidebarBrandingLogo";
import { HiSparkles, HiXMark } from "./adminSidebarIcons";

type AdminSidebarHeaderProps = {
  appName: string;
  logoUrl: string | null;
  tenantName?: string | null;
  role?: string | null;
  onClose: () => void;
  closeButtonRef?: RefObject<HTMLButtonElement | null>;
};

/** Tujuan: merender area branding dan kontrol close pada sidebar admin. */
export function AdminSidebarHeader({
  appName,
  logoUrl,
  tenantName,
  role,
  onClose,
  closeButtonRef,
}: AdminSidebarHeaderProps) {
  return (
    <div className="min-h-32 px-8 py-5 relative overflow-hidden shrink-0">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <HiSparkles className="w-24 h-24 text-indigo-500 rotate-12" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center gap-3 w-full px-6 text-center">
        <SidebarBrandingLogo appName={appName} logoUrl={logoUrl} />
        <div className="flex flex-col items-center overflow-hidden text-center">
          <h2
            className="text-xl font-bold text-gray-900 dark:text-white truncate tracking-tight leading-none max-w-full"
            title={appName}
          >
            {appName}
          </h2>
          <div className="mt-1.5 flex flex-col items-center gap-0.5">
            <span
              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider truncate leading-tight max-w-full"
              title={tenantName || ""}
            >
              {tenantName || "Main Tenant"}
            </span>
            <div className="flex items-center gap-1">
              <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
              <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none">
                {role?.replace(/_/g, " ") || "User"}
              </span>
            </div>
          </div>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="ml-auto p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 md:hidden text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close menu"
        >
          <HiXMark className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
