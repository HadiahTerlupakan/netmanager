'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineHome, HiOutlineBriefcase, HiOutlineUser, HiOutlineCurrencyDollar } from 'react-icons/hi2'

export default function InvestorBottomNav() {
    const pathname = usePathname()

    const navItems = [
        { name: 'Dashboard', href: '/investor', icon: HiOutlineHome },
        { name: 'Proyek', href: '/investor/projects', icon: HiOutlineBriefcase },
        { name: 'Payout', href: '/investor/payouts', icon: HiOutlineCurrencyDollar },
        { name: 'Profil', href: '/investor/profile', icon: HiOutlineUser },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 w-full flex justify-center z-50 pointer-events-none">
            <div className="w-full max-w-md bg-white dark:bg-neutral-900 border-t border-gray-100 dark:border-neutral-800 pb-safe pt-2 px-6 flex justify-between items-center shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] pointer-events-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/investor' && pathname.startsWith(item.href))
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex flex-col items-center justify-center p-2 group w-16"
                        >
                            <div className={`relative p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 scale-110 shadow-inner' : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-800 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>
                                <Icon className="w-6 h-6 stroke-[2]" />
                                {isActive && (
                                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
                                )}
                            </div>
                            <span className={`text-[10px] sm:text-xs font-bold mt-1 transition-colors duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                {item.name}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
