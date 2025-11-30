'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { signOut, SessionProvider } from 'next-auth/react'
import {
    HiOutlineHome,
    HiOutlineUser,
    HiOutlineClock,
    HiOutlineCalendar,
    HiOutlineBanknotes,
    HiOutlineWrench,
    HiOutlineBell,
    HiOutlineArrowRightOnRectangle
} from 'react-icons/hi2'
import { PWAInstallBanner } from '@/components/pwa/PWAInstallBanner'
import { ToastProvider } from '@/components/ui/Toast'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const navigation = [
    { name: 'Dashboard', href: '/employee', icon: HiOutlineHome },
    { name: 'My Profile', href: '/employee/profile', icon: HiOutlineUser },
    { name: 'Attendance', href: '/employee/attendance', icon: HiOutlineClock },
    { name: 'Leaves', href: '/employee/leaves', icon: HiOutlineCalendar },
    { name: 'Payslips', href: '/employee/payslips', icon: HiOutlineBanknotes },
    { name: 'Work Orders', href: '/employee/workorders', icon: HiOutlineWrench },
    { name: 'Notifications', href: '/employee/notifications', icon: HiOutlineBell },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()

    // Automatic Service Worker Cleanup (Fix for "Failed to fetch" / 404 errors in dev)
    useEffect(() => {
        if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) {
                    console.log('Unregistering Service Worker:', registration)
                    registration.unregister()
                }
            })
        }
    }, [])

    const handleSignOut = async () => {
        await signOut({ redirect: false })
        router.push('/employee/login')
    }

    // Don't render layout for login, offline, or install pages
    if (pathname === '/employee/login' || pathname === '/employee/offline' || pathname === '/employee/install') {
        return <>{children}</>
    }

    return (
        <SessionProvider>
            <ToastProvider>
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                    {/* PWA Install Banner */}
                    <PWAInstallBanner />

                    {/* Mobile Header */}
                    <div className="lg:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 px-4 py-3 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">E</span>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">Employee</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <NotificationBell />
                            <button
                                onClick={handleSignOut}
                                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                            >
                                <HiOutlineArrowRightOnRectangle className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Desktop Header */}
                    <div className="hidden lg:block bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex items-center justify-between h-16">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                                        <span className="text-white font-bold text-lg">E</span>
                                    </div>
                                    <div>
                                        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Employee Portal</h1>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">NetManager HR</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <NotificationBell />
                                    <button
                                        onClick={handleSignOut}
                                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    >
                                        <HiOutlineArrowRightOnRectangle className="w-5 h-5" />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-8 pb-24 lg:pb-8">
                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Sidebar Navigation (Desktop Only) */}
                            <aside className="hidden lg:block lg:w-64 flex-shrink-0">
                                <nav className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-1 sticky top-24">
                                    {navigation.map((item) => {
                                        const isActive = pathname === item.href ||
                                            (item.href !== '/employee' && pathname.startsWith(item.href))

                                        return (
                                            <Link
                                                key={item.name}
                                                href={item.href}
                                                className={`flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${isActive
                                                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                <item.icon className="w-5 h-5" />
                                                {item.name}
                                            </Link>
                                        )
                                    })}
                                </nav>
                            </aside>

                            {/* Main Content */}
                            <main className="flex-1 min-w-0">
                                {children}
                            </main>
                        </div>
                    </div>

                    {/* Bottom Navigation Bar (Mobile Only) */}
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 pb-safe z-30">
                        <div className="flex justify-around items-center h-16">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href ||
                                    (item.href !== '/employee' && pathname.startsWith(item.href))

                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive
                                            ? 'text-indigo-600 dark:text-indigo-400'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                            }`}
                                    >
                                        <item.icon className={`w-6 h-6 ${isActive ? 'stroke-2' : ''}`} />
                                        <span className="text-[10px] font-medium">{item.name}</span>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </ToastProvider>
        </SessionProvider>
    )
}
