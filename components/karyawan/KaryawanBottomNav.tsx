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
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/hooks/use-permission'
import { toast } from 'react-hot-toast'

export default function KaryawanBottomNav() {
    const pathname = usePathname()
    const { hasPermission } = usePermission()

    if (pathname === '/karyawan/login') return null

    // Helper to map icon components (since config has JSX, we need to map back for this specific component structure)
    // Or better yet, we can refactor this component to use the config directly but since the config uses different icons (HeroIcons vs MaterialIcons here?)
    // Let's quickly verify if we want to switch icons or map them.
    // The previous file used Material Icons (Md...). The config I added used HeroIcons (Hi...).
    // To match the existing design, I'll map the configuration to these icons or just keep using these local definitions but mapped to permissions.
    // Given the user constraint "untuk portal karyawan pada semua akses menu nya apa bisa di tambahkan juga di matriks izin pengguna"
    // I should probably stick to the icons they are used to in this bottom nav, but map them to the permissions defined.

    const itemsWithPermissions = [
        {
            name: 'Beranda',
            href: '/karyawan/dashboard',
            icon: MdOutlineHome,
            activeIcon: MdHome,
            permission: 'k_dashboard:read' // Mapping to what I added in config: DASHBOARD: ['k_dashboard']
        },
        {
            name: 'Work Order',
            href: '/karyawan/work-order',
            icon: MdOutlineAssignment,
            activeIcon: MdAssignment,
            permission: 'k_work_order:read'
        },
        {
            name: 'Barang',
            href: '/karyawan/barang',
            icon: MdOutlineInventory2,
            activeIcon: MdInventory2,
            permission: 'k_barang:read'
        },
        {
            name: 'Absensi',
            href: '/karyawan/absensi',
            icon: MdOutlineQrCode,
            activeIcon: MdQrCode,
            permission: 'k_absensi:read'
        },
        {
            name: 'Profil',
            href: '/karyawan/profil',
            icon: MdOutlinePerson,
            activeIcon: MdPerson,
            permission: 'k_profil:read'
        },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50">
            {/* Glass effect background */}
            <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50" />

            {/* Navigation content */}
            <div className="relative flex items-center justify-around h-20 max-w-lg mx-auto px-4 pb-safe">
                {itemsWithPermissions.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    const Icon = isActive ? item.activeIcon : item.icon
                    const isAllowed = hasPermission(item.permission)

                    if (!isAllowed) {
                        return (
                            <Button
                                key={item.name}
                                onClick={() => toast.error('Anda tidak memiliki akses ke menu ini.')}
                                className="relative flex flex-col items-center justify-center flex-1 py-3 opacity-40 cursor-not-allowed group"
                            >
                                <div className="p-1.5 rounded-xl grayscale">
                                    <Icon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                                </div>
                                <span className="mt-1 text-[11px] font-medium tracking-tight text-slate-400 dark:text-slate-500">
                                    {item.name}
                                </span>
                            </Button>
                        )
                    }

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
