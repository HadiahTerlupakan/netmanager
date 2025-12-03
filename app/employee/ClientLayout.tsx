'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
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
import { EmployeePermissionProvider, useEmployeePermissions } from '@/components/providers/EmployeePermissionContext'

// Navigation items with optional feature requirements
const navigationConfig = [
    { name: 'Dashboard', href: '/employee', icon: HiOutlineHome },
    { name: 'Attendance', href: '/employee/attendance', icon: HiOutlineClock, feature: 'HRIS' },
    { name: 'Leaves', href: '/employee/leaves', icon: HiOutlineCalendar, feature: 'HRIS' },
    { name: 'Payslips', href: '/employee/payslips', icon: HiOutlineBanknotes, feature: 'HRIS' },
    { name: 'Profile', href: '/employee/profile', icon: HiOutlineUser },
]

const desktopNavigationConfig = [
    ...navigationConfig,
    { name: 'Work Orders', href: '/employee/workorders', icon: HiOutlineWrench, feature: 'WORKORDERS' },
    { name: 'Notifications', href: '/employee/notifications', icon: HiOutlineBell },
]

function EmployeeLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const { hasFeature, loading: permissionsLoading } = useEmployeePermissions()

    // Filter navigation based on permissions
    const navigation = useMemo(() => {
        return navigationConfig.filter(item => {
            // No feature requirement = always show
            if (!item.feature) return true
            // Check if user has the required feature
            return hasFeature(item.feature)
        })
    }, [hasFeature])

    const desktopNavigation = useMemo(() => {
        return desktopNavigationConfig.filter(item => {
            // No feature requirement = always show
            if (!item.feature) return true
            // Check if user has the required feature
            return hasFeature(item.feature)
        })
    }, [hasFeature])

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
        <ToastProvider>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
                {/* PWA Install Banner */}
                <PWAInstallBanner />

                {/* Mobile Header - Enhanced */}
                <header className="lg:hidden sticky top-0 z-30 safe-area-inset-top shadow-md">
                    <div className="bottom-nav-blur border-b border-gray-200/50 dark:border-gray-700/50">
                        <div className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl gradient-vibrant shadow-lg flex items-center justify-center transform hover:scale-105 transition-transform">
                                    <span className="text-white font-bold text-lg drop-shadow-md">E</span>
                                </div>
                                <div>
                                    <h1 className="font-bold text-base text-gray-900 dark:text-white leading-tight">Employee</h1>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">NetManager HR</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <NotificationBell />
                                <button
                                    onClick={handleSignOut}
                                    className="touch-target p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-xl transition-all active:scale-95"
                                    aria-label="Sign out"
                                >
                                    <HiOutlineArrowRightOnRectangle className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Desktop Header - Enhanced */}
                <header className="hidden lg:block sticky top-0 z-20 shadow-sm">
                    <div className="bottom-nav-blur border-b border-gray-200/50 dark:border-gray-700/50">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex items-center justify-between h-16">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl gradient-vibrant shadow-lg flex items-center justify-center transform hover:scale-105 transition-transform">
                                        <span className="text-white font-bold text-xl drop-shadow-md">E</span>
                                    </div>
                                    <div>
                                        <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                            Employee Portal
                                        </h1>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">NetManager HR System</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <NotificationBell />
                                    <button
                                        onClick={handleSignOut}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-xl transition-all active:scale-95"
                                    >
                                        <HiOutlineArrowRightOnRectangle className="w-5 h-5" />
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-28 sm:pb-24 lg:pb-8">
                    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
                        {/* Sidebar Navigation (Desktop Only) - Enhanced */}
                        <aside className="hidden lg:block lg:w-64 flex-shrink-0">
                            <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-3 space-y-1 sticky top-24">
                                {desktopNavigation.map((item) => {
                                    const isActive = pathname === item.href ||
                                        (item.href !== '/employee' && pathname.startsWith(item.href))

                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className={`group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive
                                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md scale-[1.02]'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-[1.01]'
                                                }`}
                                        >
                                            <item.icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                            {item.name}
                                        </Link>
                                    )
                                })}
                            </nav>
                        </aside>

                        {/* Main Content */}
                        <main className="flex-1 min-w-0 fade-in">
                            {children}
                        </main>
                    </div>
                </div>

                {/* Bottom Navigation Bar (Mobile Only) - Enhanced with Glassmorphism */}
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 safe-area-inset-bottom shadow-2xl">
                    <div className="bottom-nav-blur border-t border-gray-200/50 dark:border-gray-700/50">
                        <div className="grid grid-cols-5 h-[70px] px-1">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href ||
                                    (item.href !== '/employee' && pathname.startsWith(item.href))

                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`flex flex-col items-center justify-center gap-1 touch-manipulation transition-all ${isActive
                                            ? 'transform scale-105'
                                            : 'active:scale-95'
                                            }`}
                                        aria-label={item.name}
                                    >
                                        <div className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all ${isActive
                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30'
                                            : 'bg-transparent'
                                            }`}>
                                            <item.icon
                                                className={`w-6 h-6 transition-all ${isActive
                                                    ? 'text-white scale-110'
                                                    : 'text-gray-600 dark:text-gray-400'
                                                    }`}
                                            />
                                            {isActive && (
                                                <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-white shadow-md" />
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-medium leading-tight transition-all ${isActive
                                            ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                                            : 'text-gray-500 dark:text-gray-400'
                                            }`}>
                                            {item.name}
                                        </span>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                </nav>
            </div>
        </ToastProvider>
    )
}

// Main export with EmployeePermissionProvider
export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <EmployeePermissionProvider>
                <EmployeeLayoutContent>{children}</EmployeeLayoutContent>
            </EmployeePermissionProvider>
        </SessionProvider>
    )
}
