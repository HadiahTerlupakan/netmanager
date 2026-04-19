"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useState,
  useEffect,
  useMemo,
  createContext,
  useContext,
  useCallback,
} from "react";
import {
  HiOutlineChartBar,
  HiOutlineGlobeAlt,
  HiOutlineServer,
  HiOutlineServerStack,
  HiOutlinePresentationChartLine,
  HiOutlineDevicePhoneMobile,
  HiPlus,
  HiOutlineClipboard,
  HiOutlineBolt,
  HiOutlineLink,
  HiOutlineHome,
  HiOutlineMap,
  HiOutlineUsers,
  HiChevronRight,
  HiChevronDown,
  HiOutlineWifi,
  HiOutlineArchiveBox,
  HiOutlineSquares2X2,
  HiOutlineQueueList,
  HiOutlineDocument,
  HiOutlineShoppingCart,
  HiOutlineCircleStack, // Database replacement
  HiOutlineUser,
  HiOutlineArrowTrendingUp,
  HiOutlineCreditCard,
  HiOutlineKey,
  HiOutlineCog6Tooth,
  HiOutlinePhoto,
  HiOutlineEnvelope,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCodeBracket,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineUserGroup,
  HiOutlineWrench,
  HiOutlineCube,
  HiOutlineTruck,
  HiOutlineArrowDownTray,
  HiOutlineArrowUpTray,
  HiOutlineCurrencyDollar,
  HiXMark, // For close button
  HiArrowRightOnRectangle, // For logout visual
  HiSparkles,
  HiOutlineClipboardDocumentList,
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
  HiOutlineMegaphone,
  HiOutlineBriefcase,
  HiOutlineBuildingOffice,
  HiOutlineClipboardDocumentCheck,
  HiOutlineTag,
  HiOutlineTicket,
  HiOutlineMapPin,
  HiOutlineShoppingBag,
  HiOutlineBuildingLibrary,
  HiOutlineChartPie,
  HiOutlineSpeakerWave,
  HiOutlineArrowPath,
  HiOutlineComputerDesktop,
  HiOutlinePresentationChartBar,
  HiOutlineCloud,
  HiOutlineArrowsRightLeft,
  HiOutlineNoSymbol,
  HiOutlineBanknotes,
} from "react-icons/hi2";
import { useSettings } from "@/hooks/useSettings";
import {
  DEFAULT_PUBLIC_APP_LOGO_URL,
  DEFAULT_PUBLIC_APP_NAME,
  usePublicBranding,
} from "@/hooks/usePublicBranding";
import { usePermission } from "@/hooks/use-permission";
import { useSession, signOut } from "next-auth/react";
import { SidebarBrandingLogo } from "@/components/layout/SidebarBrandingLogo";

// Context for sidebar state
const SidebarContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

import { ADMIN_MENU_CONFIG, type MenuConfig } from "@/lib/menu-config";

// Icon Mapping
const IconMap: Record<string, React.ElementType> = {
  HiOutlineChartBar,
  HiOutlineGlobeAlt,
  HiOutlineServer,
  HiOutlineServerStack,
  HiOutlinePresentationChartLine,
  HiOutlineDevicePhoneMobile,
  HiPlus,
  HiOutlineClipboard,
  HiOutlineBolt,
  HiOutlineLink,
  HiOutlineHome,
  HiOutlineMap,
  HiOutlineUsers,
  HiChevronRight,
  HiChevronDown,
  HiOutlineWifi,
  HiOutlineArchiveBox,
  HiOutlineSquares2X2,
  HiOutlineQueueList,
  HiOutlineDocument,
  HiOutlineShoppingCart,
  HiOutlineCircleStack,
  HiOutlineUser,
  HiOutlineArrowTrendingUp,
  HiOutlineCreditCard,
  HiOutlineKey,
  HiOutlineCog6Tooth,
  HiOutlinePhoto,
  HiOutlineEnvelope,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCodeBracket,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineUserGroup,
  HiOutlineWrench,
  HiOutlineCube,
  HiOutlineTruck,
  HiOutlineArrowDownTray,
  HiOutlineArrowUpTray,
  HiOutlineCurrencyDollar,
  HiXMark,
  HiArrowRightOnRectangle,
  HiSparkles,
  HiOutlineClipboardDocumentList,
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
  HiOutlineMegaphone,
  HiOutlineBriefcase,
  HiOutlineBuildingOffice,
  HiOutlineClipboardDocumentCheck,
  HiOutlineTag,
  HiOutlineTicket,
  HiOutlineMapPin,
  HiOutlineSpeakerWave,
  HiOutlineArrowPath,
  HiOutlineShoppingBag,
  HiOutlineBuildingLibrary,
  HiOutlineChartPie,
  HiOutlineComputerDesktop,
  HiOutlinePresentationChartBar,
  HiOutlineCloud,
  HiOutlineArrowsRightLeft,
  HiOutlineNoSymbol,
  HiOutlineBanknotes,
};

const getIcon = (name: string | undefined, className: string) => {
  if (!name || !IconMap[name]) return null;
  const Icon = IconMap[name];
  return <Icon className={className} />;
};

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const { settings } = useSettings();
  const { branding } = usePublicBranding();
  const { data: session } = useSession();
  const appName =
    branding?.namaAplikasi || settings?.namaAplikasi || DEFAULT_PUBLIC_APP_NAME;
  const logoUrl = branding?.appLogoUrl || DEFAULT_PUBLIC_APP_LOGO_URL;
  const [isOpen, setIsOpen] = useState(false);

  const { hasPermission } = usePermission();

  // Filter menu items based on permissions
  const filterNavItem = useCallback(
    (item: MenuConfig): MenuConfig | null => {
      if (!item) return null;

      // HIDE RADIUS menu if mode is MIKROTIK_API
      if (settings?.pppConnectionMode === "MIKROTIK_API") {
        const isRadiusMenu =
          item.code === "NETWORK.RADIUS" ||
          item.code === "INTEGRATION.MIXRADIUS" ||
          item.code.startsWith("INTEGRATION.MIXRADIUS_");

        if (isRadiusMenu) {
          return null;
        }
      }

      let filteredChildren: MenuConfig[] | undefined = undefined;

      if (item.children && Array.isArray(item.children)) {
        filteredChildren = item.children
          .map(filterNavItem)
          .filter((child): child is MenuConfig => child !== null);
      }

      // Special case: If INTEGRATION menu has no children left (because all were RADIUS), hide the parent too
      if (
        item.code === "INTEGRATION" &&
        (!filteredChildren || filteredChildren.length === 0)
      ) {
        return null;
      }

      // Use the last part of the code (e.g. "NETWORK.MIKROTIK" -> "MIKROTIK")
      const permissionResource = item.code
        ? item.code.includes(".")
          ? item.code.split(".").pop()!
          : item.code
        : "";

      const hasItemPermission = permissionResource
        ? hasPermission(`${permissionResource.toLowerCase()}:read`)
        : true;

      // If it has children, and some are visible, we should show this parent
      // EVEN IF the parent permission itself is false.
      // (This allows "NETWORK.MIKROTIK" access to implicitly show "Network" menu)
      if (filteredChildren && filteredChildren.length > 0) {
        return { ...item, children: filteredChildren };
      }

      // If no children (or no visible children), strictly respect the item's own permission
      if (!hasItemPermission) {
        return null;
      }

      return { ...item, children: filteredChildren };
    },
    [hasPermission, settings?.pppConnectionMode],
  );

  const allNavItems = ADMIN_MENU_CONFIG;

  const navItems = useMemo(() => {
    if (!allNavItems || !Array.isArray(allNavItems)) return [];
    return allNavItems
      .map(filterNavItem)
      .filter((item): item is MenuConfig => item !== null);
  }, [allNavItems, filterNavItem]);

  // Auto-expand menu
  useEffect(() => {
    const menusToExpand: string[] = [];
    navItems?.forEach((item) => {
      if (item.children) {
        // Parent is active if any child is active
        const hasActiveChild = item.children.some((child) => {
          const childPath = child.path || "";
          if (child.exact) {
            return pathname === childPath;
          }
          return (
            pathname === childPath || pathname?.startsWith(childPath + "/")
          );
        });
        // Use item.code as key for expansion tracking since path might be null for parents
        if (hasActiveChild && !expandedMenus.has(item.code)) {
          menusToExpand.push(item.code);
        }
      }
    });

    if (menusToExpand.length > 0) {
      setExpandedMenus((prev) => {
        const newSet = new Set(prev);
        menusToExpand.forEach((code) => newSet.add(code));
        return newSet;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleMenu = (code: string) => {
    setExpandedMenus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  const isMenuExpanded = (code: string) => expandedMenus.has(code);

  // Mobile toggle integration
  useEffect(() => {
    const win = window as Window & { toggleAdminSidebar?: () => void };
    win.toggleAdminSidebar = () => setIsOpen(!isOpen);
    return () => {
      delete win.toggleAdminSidebar;
    };
  }, [isOpen]);

  // Close on route change (mobile)
  useEffect(() => {
    const handleRouteChange = () => {
      if (window.innerWidth < 768) {
        setIsOpen(false);
      }
    };
    handleRouteChange();
  }, [pathname]);

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      <>
        {/* Mobile Overlay with Blur */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ease-out"
            onClick={() => setIsOpen(false)}
          />
        )}

        <aside
          className={`fixed md:sticky top-0 left-0 h-screen w-72 shrink-0 bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800 z-50 transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col ${
            isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } shadow-2xl md:shadow-none`}
        >
          {/* Modern Logo Section */}
          <div className="h-24 flex items-center px-8 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <HiSparkles className="w-24 h-24 text-indigo-500 rotate-12" />
            </div>

            <div className="relative z-10 flex items-center gap-3 w-full">
              <SidebarBrandingLogo appName={appName} logoUrl={logoUrl} />
              <div className="flex flex-col justify-center overflow-hidden">
                <h2
                  className="text-xl font-bold text-gray-900 dark:text-white truncate tracking-tight leading-none"
                  title={appName}
                >
                  {appName}
                </h2>
                <div className="flex flex-col mt-1.5 gap-0.5">
                  <span
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider truncate leading-tight"
                    title={session?.user?.tenantName || ""}
                  >
                    {session?.user?.tenantName || "Main Tenant"}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600 shrink-0" />
                    <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest leading-none">
                      {session?.user?.role?.replace(/_/g, " ") || "User"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="ml-auto p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 md:hidden text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close menu"
              >
                <HiXMark className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Navigation Area */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 scrollbar-track-transparent hover:scrollbar-thumb-gray-300 dark:hover:scrollbar-thumb-gray-700">
            <div className="space-y-1">
              {navItems?.map((item, index) => {
                // Render section header if this item starts a new section
                const prevItem = index > 0 ? navItems[index - 1] : null;
                const showSectionHeader =
                  item.section && item.section !== prevItem?.section;
                const itemPath = item.path || ""; // Fallback for parent items
                const isActive = item.exact
                  ? pathname === itemPath
                  : itemPath &&
                    (pathname === itemPath ||
                      pathname?.startsWith(itemPath + "/"));

                const hasChildren = item.children && item.children.length > 0;
                const isExpanded = hasChildren
                  ? isMenuExpanded(item.code)
                  : false;
                const hasActiveChild =
                  hasChildren &&
                  item.children?.some((child) => {
                    const childPath = child.path || "";
                    if (child.exact) return pathname === childPath;
                    return (
                      pathname === childPath ||
                      pathname?.startsWith(childPath + "/")
                    );
                  });

                // Section header component
                const SectionHeader = showSectionHeader ? (
                  <div className="pt-4 pb-2 first:pt-0">
                    <h3 className="px-4 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                      {item.section}
                    </h3>
                  </div>
                ) : null;

                if (hasChildren) {
                  return (
                    <div key={item.code}>
                      {SectionHeader}
                      <div className="space-y-1 mb-1">
                        <button
                          onClick={() => toggleMenu(item.code)}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden ${
                            isActive || hasActiveChild
                              ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/10"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200"
                          }`}
                        >
                          {/* Active Indicator Line */}
                          {(isActive || hasActiveChild) && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
                          )}

                          <div className="flex items-center gap-3.5 z-10">
                            <span
                              className={`transition-colors duration-200 ${isActive || hasActiveChild ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"}`}
                            >
                              {getIcon(item.icon, "w-5 h-5")}
                            </span>
                            <span>{item.name}</span>
                          </div>
                          <HiChevronDown
                            className={`w-4 h-4 text-gray-400 transition-transform duration-300 ease-in-out ${isExpanded ? "rotate-180 text-indigo-500" : ""}`}
                          />
                        </button>

                        <div
                          className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100 translate-y-0" : "grid-rows-[0fr] opacity-0 -translate-y-2"}`}
                        >
                          <div className="overflow-hidden">
                            <div className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-6 my-1 pl-3 space-y-1">
                              {item.children?.map((child) => {
                                const childPath = child.path || "#";
                                const isChildActive = child.exact
                                  ? pathname === childPath
                                  : pathname === childPath ||
                                    pathname?.startsWith(childPath + "/");

                                return (
                                  <Link
                                    key={childPath}
                                    href={childPath}
                                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group/child ${
                                      isChildActive
                                        ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20"
                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                                    }`}
                                  >
                                    {child.icon ? (
                                      <span
                                        className={`transition-colors duration-200 ${isChildActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"}`}
                                      >
                                        {getIcon(child.icon, "w-4 h-4")}
                                      </span>
                                    ) : (
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                                          isChildActive
                                            ? "bg-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/30"
                                            : "bg-gray-300 dark:bg-gray-600 group-hover/child:bg-gray-400"
                                        }`}
                                      />
                                    )}
                                    <span>{child.name}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={item.code}>
                    {SectionHeader}
                    <Link
                      href={itemPath}
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden mb-1 ${
                        isActive
                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/10 shadow-sm shadow-indigo-100/50 dark:shadow-none"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200"
                      }`}
                    >
                      {/* Active Indicator Line */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
                      )}

                      <div
                        className={`transition-colors duration-200 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"}`}
                      >
                        {getIcon(item.icon, "w-5 h-5")}
                      </div>
                      <span>{item.name}</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-100 to-violet-100 dark:from-indigo-900 dark:to-violet-900 flex items-center justify-center border-2 border-white dark:border-gray-700 shadow-sm shrink-0 relative overflow-hidden">
                {session?.user?.image ? (
                  <Image
                    width={40}
                    height={40}
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-300">
                    {(session?.user?.name || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {session?.user?.name || "User"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {session?.user?.email || "admin@example.com"}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                title="Sign Out"
              >
                <HiArrowRightOnRectangle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </aside>
      </>
    </SidebarContext.Provider>
  );
}
