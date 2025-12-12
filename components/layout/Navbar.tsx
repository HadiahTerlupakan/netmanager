"use client"
import * as React from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { HiBars3 } from 'react-icons/hi2'

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <header className="h-16 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 sticky top-0 z-10">
      <div className="h-full flex items-center justify-between px-6">
        <div className="flex items-center">
          <button
            onClick={() => (window as any).toggleAdminSidebar?.()}
            className="mr-4 p-2 -ml-2 text-gray-500 rounded-md md:hidden hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <HiBars3 className="w-6 h-6" />
          </button>
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          {session?.user && (
            <>
              <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                  {(session.user.name || session.user.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="text-sm">
                  <div className="font-medium text-gray-900 dark:text-white text-xs leading-tight">{session.user.name || session.user.email}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">
                    {session.user.role === 'ADMIN'
                      ? 'Administrator'
                      : (session.user as any).employee?.position?.name || (session.user as any).employee?.department?.name || 'Staff'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Keluar
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}


