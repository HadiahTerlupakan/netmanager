'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    MdOutlineHome,
    MdHome,
    MdOutlineAssignment,
    MdAssignment,
    MdOutlineInventory2,
    MdInventory2,
    MdOutlineQrCode,
    MdQrCode,
    MdOutlinePerson,
    MdPerson
} from 'react-icons/md'

const navItems = [
    {
        name: 'Beranda',
        href: '/karyawan/dashboard',
        icon: MdOutlineHome,
        activeIcon: MdHome,
    },
    {
        name: 'Work Order',
        href: '/karyawan/work-order',
        icon: MdOutlineAssignment,
        activeIcon: MdAssignment,
    },
    {
        name: 'Barang',
        href: '/karyawan/barang',
        icon: MdOutlineInventory2,
        activeIcon: MdInventory2,
    },
    {
        name: 'Absensi',
        href: '/karyawan/absensi',
        icon: MdOutlineQrCode,
        activeIcon: MdQrCode,
    },
    {
        name: 'Profil',
        href: '/karyawan/profil',
        icon: MdOutlinePerson,
        activeIcon: MdPerson,
    },
]

export default function KaryawanBottomNav() {
    const pathname = usePathname()

    if (pathname === '/karyawan/login') return null

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50">
            {/* Glass effect background */}
            <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50" />

            {/* Navigation content */}
            <div className="relative flex items-center justify-around h-20 max-w-lg mx-auto px-4 pb-safe">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icon = isActive ? item.activeIcon : item.icon

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`relative flex flex-col items-center justify-center flex-1 py-3 transition-all duration-200 ${isActive
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-slate-400 dark:text-slate-500 active:scale-95'
                                }`}
                        >
                            {/* Active indicator */}
                            {isActive && (
                                <div className="absolute -top-0.5 w-8 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
                            )}

                            <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-blue-50 dark:bg-blue-900/40' : ''
                                }`}>
                                <Icon className={`w-6 h-6 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                            </div>

                            <span className={`mt-1 text-[11px] font-medium tracking-tight ${isActive ? 'text-blue-600 dark:text-blue-400' : ''
                                }`}>
                                {item.name}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
