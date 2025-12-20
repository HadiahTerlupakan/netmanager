'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import { KaryawanPushNotification } from '@/components/karyawan/KaryawanPushNotification'
import { KaryawanNotificationBell } from '@/components/karyawan/KaryawanNotificationBell'

import {
    MdNotifications,
    MdAssignment,
    MdInventory2,
    MdArrowForward,
    MdAdd,
    MdRemove,
    MdHistory,
    MdWork
} from 'react-icons/md'
import Link from 'next/link'

interface DashboardStats {
    workOrdersAssigned: number
    workOrdersPending: number
    woCompletedToday: number
    woCompletedWeek: number
    woCompletedMonth: number
    barangKeluarToday: number
    barangMasukToday: number
}

import { toast } from 'react-hot-toast'
import { usePermission } from '@/hooks/use-permission'

export default function KaryawanDashboardPage() {
    const { isLoading: authLoading, isAuthenticated, user } = useKaryawanAuth()
    const { hasPermission } = usePermission()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // Only redirect to login if not loading AND not authenticated
        if (!authLoading && !isAuthenticated) {
            router.push('/karyawan/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            fetchDashboardStats()
        }
    }, [authLoading, isAuthenticated])

    const fetchDashboardStats = async () => {
        try {
            const res = await fetch('/api/karyawan/dashboard')
            if (res.ok) {
                const data = await res.json()
                setStats(data)
            } else {
                // Set default stats if API fails
                setStats({
                    workOrdersAssigned: 0,
                    workOrdersPending: 0,
                    woCompletedToday: 0,
                    woCompletedWeek: 0,
                    woCompletedMonth: 0,
                    barangKeluarToday: 0,
                    barangMasukToday: 0
                })
            }
        } catch (error) {
            console.error('Failed to fetch dashboard stats:', error)
            setStats({
                workOrdersAssigned: 0,
                workOrdersPending: 0,
                woCompletedToday: 0,
                woCompletedWeek: 0,
                woCompletedMonth: 0,
                barangKeluarToday: 0,
                barangMasukToday: 0
            })
        } finally {
            setIsLoading(false)
        }
    }

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const renderQuickMenuItem = (
        href: string,
        icon: React.ReactNode,
        title: string,
        subtitle: string,
        colorClass: string,
        iconColorClass: string,
        permission: string
    ) => {
        const isAllowed = hasPermission(permission)

        if (!isAllowed) {
            return (
                <button
                    key={title}
                    onClick={() => toast.error('Anda tidak memiliki akses ke menu ini.')}
                    className="w-full flex flex-col gap-3 rounded-xl bg-white dark:bg-[#1c2936] p-4 items-start shadow-sm border border-gray-100 dark:border-gray-800 opacity-60 cursor-not-allowed group text-left grayscale"
                >
                    <div className={`size-10 rounded-lg ${colorClass} flex items-center justify-center ${iconColorClass}`}>
                        {icon}
                    </div>
                    <div>
                        <h2 className="text-[#111418] dark:text-white text-sm font-bold leading-tight">{title}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
                    </div>
                </button>
            )
        }

        return (
            <Link key={title} href={href}>
                <button className="w-full flex flex-col gap-3 rounded-xl bg-white dark:bg-[#1c2936] p-4 items-start shadow-sm border border-gray-100 dark:border-gray-800 hover:border-blue-500/50 transition-colors group text-left">
                    <div className={`size-10 rounded-lg ${colorClass} flex items-center justify-center ${iconColorClass} group-hover:scale-110 transition-transform`}>
                        {icon}
                    </div>
                    <div>
                        <h2 className="text-[#111418] dark:text-white text-sm font-bold leading-tight">{title}</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
                    </div>
                </button>
            </Link>
        )
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased transition-colors duration-200">
            <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">

                {/* Sticky Header */}
                <div className="sticky top-0 z-20 flex items-center bg-[#f6f7f8] dark:bg-[#101922] p-4 pb-2 justify-between border-b border-gray-100 dark:border-gray-800">
                    <div className="flex size-10 shrink-0 items-center">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-full size-10 flex items-center justify-center text-white font-bold text-lg">
                            {user?.name?.charAt(0)?.toUpperCase() || 'K'}
                        </div>
                    </div>
                    <div className="flex flex-col items-center">
                        <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#111418] dark:text-white">Dashboard</h2>
                    </div>
                    <div className="flex size-10 items-center justify-end">
                        <KaryawanNotificationBell />
                    </div>
                </div>

                <div className="flex flex-col flex-1 pb-24">
                    {/* Greeting Section */}
                    <div className="px-4 pt-6 pb-2">
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Selamat datang,</p>
                        <h2 className="text-2xl font-bold leading-tight text-[#111418] dark:text-white">{user?.name || 'Karyawan'}</h2>
                    </div>


                    {/* Push Notification Banner */}
                    <div className="px-4 pb-4">
                        <KaryawanPushNotification />
                    </div>
                    <div className="p-4">
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg p-5">
                            <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl"></div>
                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-blue-100 text-sm font-medium mb-1">Work Order Saya</p>
                                        <h3 className="text-3xl font-bold tracking-tight">
                                            {stats?.workOrdersAssigned || 0}
                                        </h3>
                                    </div>
                                    <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                                        <MdAssignment className="text-white text-xl" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="flex h-2 w-2 rounded-full bg-green-400"></span>
                                    <p className="text-sm font-medium text-blue-50">
                                        {stats?.workOrdersPending || 0} tiket tersedia untuk diambil
                                    </p>
                                </div>
                                <div className="pt-2">
                                    {hasPermission('k_work_order:read') ? (
                                        <Link href="/karyawan/work-order">
                                            <button className="w-full bg-white text-blue-600 hover:bg-blue-50 font-bold py-3 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                                                <span>Lihat Work Order</span>
                                                <MdArrowForward className="text-sm" />
                                            </button>
                                        </Link>
                                    ) : (
                                        <button
                                            onClick={() => toast.error('Anda tidak memiliki akses ke Work Order.')}
                                            className="w-full bg-white/50 text-white font-bold py-3 px-4 rounded-lg text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                                        >
                                            <span>Akses Ditolak</span>
                                            <MdArrowForward className="text-sm" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Performance Stats */}
                    <div className="px-4 pb-4">
                        <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Tiket Selesai</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats?.woCompletedToday || 0}</span>
                                    <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mt-1">Hari Ini</span>
                                </div>
                                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats?.woCompletedWeek || 0}</span>
                                    <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mt-1">Minggu</span>
                                </div>
                                <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20">
                                    <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">{stats?.woCompletedMonth || 0}</span>
                                    <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400 mt-1">Bulan</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="px-4 pb-4">
                        <div className="bg-white dark:bg-[#1c2936] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Aktivitas Barang</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Barang Masuk</span>
                                    <div className="flex items-center gap-1.5">
                                        <MdAdd className="text-green-600 text-lg" />
                                        <span className="font-bold text-sm dark:text-white">{stats?.barangMasukToday || 0}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Barang Keluar</span>
                                    <div className="flex items-center gap-1.5">
                                        <MdRemove className="text-orange-600 text-lg" />
                                        <span className="font-bold text-sm dark:text-white">{stats?.barangKeluarToday || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Menu */}
                    <div className="px-4">
                        <h3 className="text-[#111418] dark:text-white text-lg font-bold mb-3 px-1">Menu Cepat</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {renderQuickMenuItem(
                                '/karyawan/work-order',
                                <MdWork className="text-2xl" />,
                                'Ambil Tiket',
                                'Work Order',
                                'bg-blue-50 dark:bg-blue-900/20',
                                'text-blue-600',
                                'k_work_order:read'
                            )}
                            {renderQuickMenuItem(
                                '/karyawan/barang/masuk',
                                <MdAdd className="text-2xl" />,
                                'Barang Masuk',
                                'Input stok',
                                'bg-green-50 dark:bg-green-900/20',
                                'text-green-600',
                                'k_barang:read'
                            )}
                            {renderQuickMenuItem(
                                '/karyawan/barang/keluar',
                                <MdRemove className="text-2xl" />,
                                'Barang Keluar',
                                'Ambil stok',
                                'bg-orange-50 dark:bg-orange-900/20',
                                'text-orange-600',
                                'k_barang:read'
                            )}
                            {renderQuickMenuItem(
                                '/karyawan/barang/riwayat',
                                <MdHistory className="text-2xl" />,
                                'Riwayat',
                                'Transaksi',
                                'bg-purple-50 dark:bg-purple-900/20',
                                'text-purple-600',
                                'k_barang:read'
                            )}
                            {renderQuickMenuItem(
                                '/karyawan/absensi',
                                <MdAssignment className="text-2xl" />,
                                'Absensi',
                                'Check In/Out',
                                'bg-pink-50 dark:bg-pink-900/20',
                                'text-pink-600',
                                'k_absensi:read'
                            )}
                            {renderQuickMenuItem(
                                '/karyawan/lembur',
                                <MdWork className="text-2xl" />,
                                'Lembur',
                                'Ajukan Lembur',
                                'bg-indigo-50 dark:bg-indigo-900/20',
                                'text-indigo-600',
                                'k_absensi:read'
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
