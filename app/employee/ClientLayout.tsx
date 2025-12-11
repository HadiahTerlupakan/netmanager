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
    HiOutlineWrench,
    HiOutlineBell,
    HiOutlineArrowRightOnRectangle,
    HiOutlineCube
} from 'react-icons/hi2'
import { PWAInstallBanner } from '@/components/pwa/PWAInstallBanner'
import { ToastProvider } from '@/components/ui/Toast'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { EmployeePermissionProvider, useEmployeePermissions } from '@/components/providers/EmployeePermissionContext'
import { ThemeProvider } from '../contexts/ThemeContext'

// Navigation items with optional feature requirements
// Reorganized for mobile: Cuti at leftmost, Dashboard in center (3rd position)
// Individual menu items with EMPLOYEE.* feature codes
const dashboardItem = { name: 'Dashboard', href: '/employee', icon: HiOutlineHome, feature: undefined }
const cutiItem = { name: 'Cuti', href: '/employee/leaves', icon: HiOutlineCalendar, feature: 'EMPLOYEE.CUTI' }
const absensiItem = { name: 'Absensi', href: '/employee/attendance', icon: HiOutlineClock, feature: 'EMPLOYEE.ABSENSI' }
const gudangItem = { name: 'Gudang', href: '/employee/inventory', icon: HiOutlineCube, feature: 'EMPLOYEE.INVENTORY' }
const woItem = { name: 'Work Orders', href: '/employee/workorders', icon: HiOutlineWrench, feature: 'EMPLOYEE.WORKORDERS' }

// Mobile Navigation: Center Dashboard for easy access
const navigationConfig = [
    cutiItem,
    absensiItem,
    dashboardItem, // Center position
    gudangItem,
    woItem,
]

// Desktop Navigation: Dashboard first
const desktopNavigationConfig = [
    dashboardItem, // First position
    cutiItem,
    absensiItem,
    gudangItem,
    woItem,
    { name: 'Profil', href: '/employee/profile', icon: HiOutlineUser, feature: undefined },
    { name: 'Notifikasi', href: '/employee/notifications', icon: HiOutlineBell, feature: undefined },
]

import { useSettings } from '@/hooks/useSettings'

function EmployeeLayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const { hasFeature } = useEmployeePermissions()
    const { settings } = useSettings()

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
            <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
                {/* PWA Install Banner */}
                <PWAInstallBanner />

                {/* Mobile Header - Enhanced Premium Design */}
                <header className="lg:hidden sticky top-0 z-30 safe-area-inset-top">
                    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm transition-all duration-300">
                        <div className="px-4 h-[60px] flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {settings?.logoAplikasi ? (
                                    <div className="relative h-9 w-auto max-w-[140px]">
                                        <img
                                            src={settings.logoAplikasi}
                                            alt={settings.namaAplikasi || 'Logo'}
                                            className="h-full w-full object-contain object-left"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md flex items-center justify-center transform hover:scale-105 transition-all duration-300">
                                        <span className="text-white font-bold text-lg">E</span>
                                    </div>
                                )}
                                {!settings?.logoAplikasi && (
                                    <div>
                                        <h1 className="font-bold text-base text-gray-900 dark:text-white leading-tight tracking-tight">
                                            {settings?.namaAplikasi || 'Employee'}
                                        </h1>
                                        <p className="text-[10px] uppercase tracking-wider text-indigo-500 font-semibold">Portal Karyawan</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <NotificationBell />
                                <button
                                    onClick={handleSignOut}
                                    className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all active:scale-95 border border-transparent hover:border-red-100"
                                    aria-label="Sign out"
                                >
                                    <HiOutlineArrowRightOnRectangle className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Desktop Header - Premium Glassmorphism Design */}
                <header className="hidden lg:block sticky top-0 z-20">
                    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm transition-all duration-300">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex items-center justify-between h-20">
                                <div className="flex items-center gap-4">
                                    {settings?.logoAplikasi ? (
                                        <div className="relative h-10 w-auto">
                                            <img
                                                src={settings.logoAplikasi}
                                                alt={settings.namaAplikasi || 'Logo'}
                                                className="h-full w-full object-contain"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 flex items-center justify-center transform hover:scale-105 transition-all duration-300">
                                            <span className="text-white font-bold text-xl">E</span>
                                        </div>
                                    )}

                                    <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

                                    <div>
                                        <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                                            {settings?.namaAplikasi ? `${settings.namaAplikasi} Employee` : 'Employee Portal'}
                                        </h1>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                                            {settings?.perusahaan || 'NetManager HR System'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <NotificationBell />
                                    <button
                                        onClick={handleSignOut}
                                        className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all duration-200 border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                                    >
                                        <HiOutlineArrowRightOnRectangle className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-28 sm:pb-24 lg:pb-8">
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Sidebar Navigation (Desktop Only) - Enhanced */}
                        <aside className="hidden lg:block lg:w-72 flex-shrink-0">
                            <nav className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 p-4 space-y-1.5 sticky top-28">
                                <div className="px-4 py-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Menu Utama
                                </div>
                                {desktopNavigation.map((item) => {
                                    const isActive = pathname === item.href ||
                                        (item.href !== '/employee' && pathname.startsWith(item.href))

                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.href}
                                            className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                                                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 translate-x-1'
                                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-indigo-600 dark:hover:text-indigo-400'
                                                }`}
                                        >
                                            <item.icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110 text-gray-400 group-hover:text-indigo-500'}`} />
                                            {item.name}
                                            {isActive && (
                                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50 shadow-sm" />
                                            )}
                                        </Link>
                                    )
                                })}
                            </nav>
                        </aside>

                        {/* Main Content */}
                        <main className="flex-1 min-w-0 animate-fade-in">
                            {children}
                        </main>
                    </div>
                </div>

                {/* Bottom Navigation Bar (Mobile Only) - Professional Glassmorphism */}
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 safe-area-inset-bottom shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)]">
                    <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-200/60 dark:border-gray-800/60">
                        <div className="grid grid-cols-5 h-[76px] px-2 pb-safe">
                            {navigation.map((item) => {
                                const isActive = pathname === item.href ||
                                    (item.href !== '/employee' && pathname.startsWith(item.href))

                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={`group flex flex-col items-center justify-center gap-1.5 touch-manipulation transition-all duration-300 ${isActive
                                            ? ''
                                            : 'hover:bg-gray-50/50 dark:hover:bg-white/5'
                                            }`}
                                        aria-label={item.name}
                                    >
                                        <div className={`relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300 ${isActive
                                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 -translate-y-1'
                                            : 'bg-transparent group-active:scale-95'
                                            }`}>
                                            <item.icon
                                                className={`w-5 h-5 transition-all duration-300 ${isActive
                                                    ? 'text-white'
                                                    : 'text-gray-500 dark:text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'
                                                    }`}
                                            />
                                        </div>
                                        <span className={`text-[10px] font-medium leading-none transition-all duration-300 ${isActive
                                            ? 'text-indigo-600 dark:text-indigo-400 font-bold -translate-y-0.5'
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
            <ThemeProvider>
                <EmployeePermissionProvider>
                    <EmployeeLayoutContent>{children}</EmployeeLayoutContent>
                </EmployeePermissionProvider>
            </ThemeProvider>
        </SessionProvider>
    )
}
