"use client"

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  HiOutlineHome,
  HiOutlineDocumentText,
  HiOutlineUser,
  HiOutlineInformationCircle,
} from 'react-icons/hi2'

const menuItems = [
  {
    href: '/pelanggan',
    label: 'Beranda',
    icon: HiOutlineHome,
  },
  {
    href: '/pelanggan/tagihan',
    label: 'Tagihan',
    icon: HiOutlineDocumentText,
  },
  {
    href: '/pelanggan/profil',
    label: 'Profil',
    icon: HiOutlineUser,
  },
  {
    href: '/pelanggan/bantuan',
    label: 'Bantuan',
    icon: HiOutlineInformationCircle,
  },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/pelanggan') {
      return pathname === '/pelanggan'
    }
    return pathname?.startsWith(href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 md:hidden safe-area-inset-bottom shadow-lg">
      <div className="grid grid-cols-4 h-16 safe-area-inset-bottom">
        {menuItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] active:bg-gray-50 dark:active:bg-gray-800 transition-colors touch-manipulation"
            >
              <Icon
                className={`w-5 h-5 transition-colors ${
                  active
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors leading-tight ${
                  active
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

