"use client"

import { HiBars3 } from 'react-icons/hi2'
import NotificationBell from './NotificationBell'
import { getWithExpiry } from '@/lib/utils/storage-with-expiry'
import { useEffect, useState } from 'react'

interface PelangganHeaderProps {
  title: string
  subtitle?: string
}

export default function PelangganHeader({ title, subtitle }: PelangganHeaderProps) {
  const [pelanggan, setPelanggan] = useState<any>(null)

  useEffect(() => {
    const pelangganData = getWithExpiry<any>('pelanggan_data')
    if (pelangganData) {
      setPelanggan(pelangganData)
    }
  }, [])

  return (
    <div className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 safe-area-inset-top">
      <div className="px-4 md:px-6 lg:px-8 py-3 md:py-4 md:py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Hamburger Menu Button - Mobile only */}
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).togglePelangganSidebar) {
                  (window as any).togglePelangganSidebar()
                }
              }}
              className="md:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200 active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
              aria-label="Toggle menu"
            >
              <HiBars3 className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white truncate">{title}</h1>
              {subtitle && (
                <p className="text-xs md:text-sm lg:text-base text-gray-600 dark:text-gray-400 mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <NotificationBell />
        </div>
      </div>
    </div>
  )
}



