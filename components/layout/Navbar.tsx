"use client"
import { useState, useRef, useEffect } from 'react'
import * as React from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { HiBars3, HiMagnifyingGlass, HiOutlineCog6Tooth, HiOutlineUser, HiArrowRightOnRectangle } from 'react-icons/hi2'
import { WorkOrderBell } from '@/components/notifications/WorkOrderBell'
import { AdminNotificationBell } from '@/components/notifications/AdminNotificationBell'
import { CustomerSupportBell } from '@/components/notifications/CustomerSupportBell'

export default function Navbar() {
  const { data: session } = useSession()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <header className="h-16 bg-white dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30 transition-colors duration-300">
      <div className="h-full flex items-center justify-between px-4 sm:px-6 gap-4">

        {/* Left: Mobile Toggle */}
        <div className="flex items-center shrink-0 md:hidden">
          <button
            onClick={() => {
              const win = window as Window & {
                toggleAdminSidebar?: () => void;
                toggleEmployeeSidebar?: () => void;
              }
              win.toggleAdminSidebar?.()
              win.toggleEmployeeSidebar?.()
            }}
            className="p-2 -ml-2 text-gray-500 hover:text-indigo-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle Menu"
          >
            <HiBars3 className="w-6 h-6" />
          </button>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-2xl flex items-center">
          <div className="relative w-full max-w-md group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <HiMagnifyingGlass className="h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search resources..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-full leading-5 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:bg-white dark:focus:bg-gray-950 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 sm:text-sm"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-400 text-xs border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 hidden sm:block">⌘K</span>
            </div>
          </div>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">

          {/* Work Order Notifications (NEW) */}
          <WorkOrderBell />

          {/* Customer Support Tickets */}
          <CustomerSupportBell />

          {/* Notifications */}
          <AdminNotificationBell />

          {/* Settings (Optional Utility) */}
          <button className="hidden sm:block p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 rounded-full transition-all duration-200">
            <HiOutlineCog6Tooth className="w-6 h-6" />
          </button>

          {/* Separator */}
          <div className="h-8 w-px bg-gray-100 dark:bg-gray-800 hidden sm:block"></div>

          {/* User Profile Card */}
          {session?.user && (
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="hidden sm:flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 p-[2px] shrink-0">
                  <div className="h-full w-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                    {session.user.image ? (
                       
                      <img src={session.user.image} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {(session.user.name || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* User Info */}
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate leading-tight">
                    {session.user.name || 'User'}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight">
                    {(session.user as { departmentName?: string; role?: string }).departmentName || ((session.user as { role?: string }).role || '').replace(/_/g, ' ')}
                  </span>
                </div>
              </button>

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50 transform origin-top-right transition-all duration-200">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{session.user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{session.user.email}</p>
                  </div>

                  <Link
                    href={
                      session.user.role === 'CUSTOMER'
                        ? '/profil'
                        : (window.location.pathname.startsWith('/karyawan')
                          ? '/karyawan/profil'
                          : `/admin/users/${session.user.id}?view=true`)
                    }
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <HiOutlineUser className="w-4 h-4 text-gray-500" />
                    Detail Profile
                  </Link>

                  <div className="my-1 border-t border-gray-100 dark:border-gray-700"></div>

                  <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left"
                  >
                    <HiArrowRightOnRectangle className="w-4 h-4" />
                    Keluar Aplikasi
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Avatar Only */}
          {session?.user && (
            <div className="sm:hidden h-9 w-9 rounded-full bg-linear-to-br from-indigo-500 to-violet-600 p-[2px] shrink-0">
              <div className="h-full w-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                {session.user.image ? (
                   
                  <img src={session.user.image} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {(session.user.name || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
