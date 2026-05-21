"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { AdminSidebarHeader } from "@/components/layout/admin-sidebar/AdminSidebarHeader";
import { AdminSidebarNav } from "@/components/layout/admin-sidebar/AdminSidebarNav";
import { AdminSidebarProfile } from "@/components/layout/admin-sidebar/AdminSidebarProfile";
import { useFilteredAdminMenu } from "@/components/layout/admin-sidebar/useFilteredAdminMenu";
import { hasActiveSidebarChild } from "@/components/layout/admin-sidebar/adminSidebarMenu";
import { usePermission } from "@/hooks/use-permission";
import { useSettings } from "@/hooks/useSettings";
import {
  DEFAULT_PUBLIC_APP_NAME,
  usePublicBranding,
} from "@/hooks/usePublicBranding";
import { resolveSidebarLogoUrl } from "@/lib/settings/publicBranding";

const MOBILE_BREAKPOINT_PX = 768;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SidebarContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { navItems, appName, logoUrl } = useSidebarBranding();
  const { isOpen, setIsOpen, isMenuExpanded, toggleMenu } =
    useSidebarExpansionState({ pathname, navItems });
  const asideRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const isMobileDrawerOpen = isOpen;
  const closeSidebar = useCallback(() => setIsOpen(false), [setIsOpen]);

  useSidebarModalFocus({
    asideRef,
    closeButtonRef,
    isOpen: isMobileDrawerOpen,
    onClose: closeSidebar,
  });

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      <SidebarOverlay isOpen={isMobileDrawerOpen} onClose={closeSidebar} />

      <aside
        ref={asideRef}
        role={isMobileDrawerOpen ? "dialog" : undefined}
        aria-modal={isMobileDrawerOpen ? "true" : undefined}
        aria-label={isMobileDrawerOpen ? "Navigasi admin" : undefined}
        onKeyDown={isMobileDrawerOpen ? handleSidebarTabKeyDown : undefined}
        className={`fixed top-0 left-0 h-screen w-72 shrink-0 bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800 z-50 transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } shadow-2xl md:shadow-none`}
      >
        <AdminSidebarHeader
          appName={appName}
          logoUrl={logoUrl}
          tenantName={session?.user?.tenantName}
          role={session?.user?.role}
          onClose={closeSidebar}
          closeButtonRef={closeButtonRef}
        />

        <AdminSidebarNav
          items={navItems}
          pathname={pathname}
          isMenuExpanded={isMenuExpanded}
          onToggleMenu={toggleMenu}
        />

        <AdminSidebarProfile user={session?.user} />
      </aside>
    </SidebarContext.Provider>
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => !element.hasAttribute("aria-hidden"));
}

function focusFirstSidebarElement({
  asideRef,
  closeButtonRef,
}: {
  asideRef: RefObject<HTMLElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const preferredTarget = closeButtonRef.current;

  if (preferredTarget) {
    preferredTarget.focus();
    return;
  }

  const container = asideRef.current;

  if (!container) {
    return;
  }

  const [firstFocusableElement] = getFocusableElements(container);
  firstFocusableElement?.focus();
}

function restoreSidebarTriggerFocus(
  previouslyFocusedElement: HTMLElement | null,
) {
  if (!previouslyFocusedElement?.isConnected) {
    return;
  }

  previouslyFocusedElement.focus();
}

function useSidebarModalFocus({
  asideRef,
  closeButtonRef,
  isOpen,
  onClose,
}: {
  asideRef: RefObject<HTMLElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
}) {
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        restoreSidebarTriggerFocus(previouslyFocusedElementRef.current);
      }
      previouslyFocusedElementRef.current = null;
      wasOpenRef.current = false;
      return;
    }

    const isOpening = !wasOpenRef.current;

    if (isOpening) {
      previouslyFocusedElementRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      focusFirstSidebarElement({ asideRef, closeButtonRef });
      wasOpenRef.current = true;
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onClose();
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [asideRef, closeButtonRef, isOpen, onClose]);
}

function handleSidebarTabKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") {
    return;
  }

  const container = event.currentTarget;
  const focusableElements = getFocusableElements(container);

  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const activeElement = document.activeElement as HTMLElement | null;
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function useAutoExpandSidebarMenus({
  navItems,
  pathname,
  setExpandedMenus,
}: {
  navItems: ReturnType<typeof useFilteredAdminMenu>;
  pathname: string;
  setExpandedMenus: Dispatch<SetStateAction<Set<string>>>;
}) {
  useEffect(() => {
    const menusToExpand = navItems
      .filter((item) => hasActiveSidebarChild(item.children, pathname))
      .map((item) => item.code);

    if (menusToExpand.length === 0) {
      return;
    }

    setExpandedMenus((previousMenus) => {
      const nextMenus = new Set(previousMenus);
      menusToExpand.forEach((code) => nextMenus.add(code));
      return nextMenus;
    });
  }, [navItems, pathname, setExpandedMenus]);
}

function useAdminSidebarWindowToggle(
  setIsOpen: Dispatch<SetStateAction<boolean>>,
) {
  useEffect(() => {
    const win = window as Window & { toggleAdminSidebar?: () => void };
    win.toggleAdminSidebar = () => setIsOpen((previousState) => !previousState);

    return () => {
      delete win.toggleAdminSidebar;
    };
  }, [setIsOpen]);
}

function useSidebarBranding() {
  const { settings, loading: isSettingsLoading } = useSettings();
  const { branding, loading: isBrandingLoading } = usePublicBranding();
  const { hasPermission, isSuperAdmin } = usePermission();
  const navItems = useFilteredAdminMenu({
    hasPermission,
    pppConnectionMode: settings?.pppConnectionMode,
    isSuperAdmin,
  });
  const appName =
    branding?.namaAplikasi || settings?.namaAplikasi || DEFAULT_PUBLIC_APP_NAME;
  const logoUrl = resolveSidebarLogoUrl({
    brandingLogoUrl: branding?.appLogoUrl,
    settingsLogoUrl: settings?.logoAplikasi,
    isBrandingLoading,
    isSettingsLoading,
  });

  return { navItems, appName, logoUrl };
}

function useSidebarExpansionState({
  pathname,
  navItems,
}: {
  pathname: string;
  navItems: ReturnType<typeof useFilteredAdminMenu>;
}) {
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false);

  useAutoExpandSidebarMenus({
    navItems,
    pathname,
    setExpandedMenus,
  });
  useAdminSidebarWindowToggle(setIsOpen);
  useCloseSidebarOnMobileRouteChange(pathname, setIsOpen);

  const toggleMenu = (code: string) => {
    setExpandedMenus((previousMenus) => {
      const nextMenus = new Set(previousMenus);

      if (nextMenus.has(code)) {
        nextMenus.delete(code);
        return nextMenus;
      }

      nextMenus.add(code);
      return nextMenus;
    });
  };

  return {
    expandedMenus,
    isOpen,
    setIsOpen,
    isMenuExpanded: (code: string) => expandedMenus.has(code),
    toggleMenu,
  };
}

function useCloseSidebarOnMobileRouteChange(
  pathname: string,
  setIsOpen: Dispatch<SetStateAction<boolean>>,
) {
  useEffect(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
      setIsOpen(false);
    }
  }, [pathname, setIsOpen]);
}

function SidebarOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ease-out"
      onClick={onClose}
    />
  );
}
