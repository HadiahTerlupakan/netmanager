"use client";
import Image from "next/image";
import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  HiBars3,
  HiMagnifyingGlass,
  HiOutlineCog6Tooth,
  HiOutlineUser,
  HiArrowRightOnRectangle,
} from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { WorkOrderBell } from "@/components/notifications/WorkOrderBell";
import { AdminNotificationBell } from "@/components/notifications/AdminNotificationBell";
import { CustomerSupportBell } from "@/components/notifications/CustomerSupportBell";
import { PaymentApprovalBell } from "@/components/notifications/PaymentApprovalBell";
import { useFCM } from "@/hooks/useFCM";
import { useClickOutside } from "@/hooks/useClickOutside";
import { ServerClock } from "@/components/layout/ServerClock";
import CommandPalette from "@/components/layout/CommandPalette";

export default function Navbar() {
  useFCM();
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const closeProfile = useCallback(() => setIsProfileOpen(false), []);
  useClickOutside(profileRef, closeProfile);

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="h-16 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30 transition-colors duration-300">
      <div className="h-full flex items-center justify-between px-3 sm:px-6 gap-3 sm:gap-4">
        {/* Left: Mobile Toggle */}
        <div className="flex items-center shrink-0 md:hidden">
          <button
            onClick={() => {
              const win = window as Window & {
                toggleAdminSidebar?: () => void;
                toggleEmployeeSidebar?: () => void;
              };
              win.toggleAdminSidebar?.();
              win.toggleEmployeeSidebar?.();
            }}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none"
            aria-label="Toggle Menu"
          >
            <HiBars3 className="w-6 h-6" />
          </button>
        </div>

        {/* Center: Search Bar (triggers Command Palette) */}
        <div className="hidden sm:flex flex-1 max-w-2xl items-center">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="relative w-full max-w-md group flex items-center gap-2 pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-full leading-5 bg-gray-50 dark:bg-gray-900 text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-white dark:hover:bg-gray-950 transition-all duration-200 sm:text-sm text-left cursor-pointer"
          >
            <HiMagnifyingGlass className="absolute left-3 h-5 w-5 text-gray-400" />
            <span>Search resources...</span>
            <span className="ml-auto text-gray-400 text-xs border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 hidden sm:block">
              ⌘K
            </span>
          </button>
        </div>

        {/* Command Palette */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
        />

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Real-time Server Clock */}
          <div className="flex items-center">
            <ServerClock />
          </div>

          {/* Work Order Notifications (NEW) */}
          <WorkOrderBell />

          {/* Customer Support Tickets */}
          <CustomerSupportBell />

          {/* Payment Approvals (NEW) */}
          <PaymentApprovalBell />

          {/* Notifications */}
          <AdminNotificationBell />

          {/* Settings (Optional Utility) */}
          <div className="hidden sm:block">
            <Button variant="ghost">
              <HiOutlineCog6Tooth className="w-6 h-6" />
            </Button>
          </div>

          {/* Separator */}
          <div className="h-8 w-px bg-gray-100 dark:bg-gray-800 hidden sm:block"></div>

          {/* User Profile Card */}
          {session?.user && (
            <div className="relative" ref={profileRef}>
              <Button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="hidden sm:flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 p-[2px] shrink-0">
                  <div className="h-full w-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                    {session.user.image ? (
                      <Image
                        width={32}
                        height={32}
                        sizes="32px"
                        src={session.user.image}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {(session.user.name || "U").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* User Info */}
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">
                    {session.user.name || "User"}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight">
                    {(
                      session.user as { departmentName?: string; role?: string }
                    ).departmentName ||
                      ((session.user as { role?: string }).role || "").replace(
                        /_/g,
                        " ",
                      )}
                  </span>
                </div>
              </Button>

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50 transform origin-top-right transition-all duration-200">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {session.user.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {session.user.email}
                    </p>
                  </div>

                  <Link
                    href={
                      session.user.role === "CUSTOMER"
                        ? "/profil"
                        : window.location.pathname.startsWith("/karyawan")
                          ? "/karyawan/profil"
                          : `/admin/users/${session.user.id}?view=true`
                    }
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors font-medium rounded-lg"
                  >
                    <HiOutlineUser className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    Detail Profile
                  </Link>

                  <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>

                  <Button
                    variant="ghost"
                    onClick={() => signOut()}
                    className="w-full flex items-center justify-start gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <HiArrowRightOnRectangle className="w-4 h-4" />
                    Keluar Aplikasi
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Avatar Only */}
          {session?.user && (
            <div className="sm:hidden h-9 w-9 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 p-[2px] shrink-0">
              <div className="h-full w-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                {session.user.image ? (
                  <Image
                    width={36}
                    height={36}
                    sizes="36px"
                    src={session.user.image}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {(session.user.name || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
