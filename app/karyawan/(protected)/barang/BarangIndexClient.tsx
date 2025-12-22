'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import Link from 'next/link'
import {
    MdPerson,
    MdMoveToInbox,
    MdOutbound,
    MdReceiptLong,
    MdChevronRight
} from 'react-icons/md'

interface DashboardStats {
    barangKeluarToday: number
    barangMasukToday: number
}

import { KaryawanNotificationBell } from '@/components/karyawan/KaryawanNotificationBell'

export default function BarangIndexPage() {
    const { isLoading: authLoading, isAuthenticated, user } = useKaryawanAuth()
    const [stats, setStats] = useState<DashboardStats>({ barangMasukToday: 0, barangKeluarToday: 0 })
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/karyawan/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/karyawan/dashboard')
                if (res.ok) {
                    const data = await res.json()
                    setStats({
                        barangMasukToday: data.barangMasukToday || 0,
                        barangKeluarToday: data.barangKeluarToday || 0
                    })
                }
            } catch (error) {
                console.error('Failed to fetch stats:', error)
            }
        }

        if (isAuthenticated) {
            fetchStats()
        }
    }, [isAuthenticated])

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased transition-colors duration-200">
            <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">

                {/* Top App Bar */}
                <header className="sticky top-0 z-20 flex items-center justify-between p-4 pb-2 bg-[#f6f7f8] dark:bg-[#101922] border-b border-gray-100 dark:border-gray-800">
                    <div className="flex size-10 shrink-0 items-center">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-full size-10 flex items-center justify-center text-white font-bold text-lg">
                            {user?.name?.charAt(0)?.toUpperCase() || 'K'}
                        </div>
                    </div>
                    <div className="flex flex-col items-center">
                        <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-[#111418] dark:text-white">Daftar Barang</h2>
                    </div>
                    <div className="flex size-10 items-center justify-end">
                        <KaryawanNotificationBell />
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto px-4 py-2 space-y-4 pb-32">
                    {/* Introduction/Subheader */}
                    <div className="pb-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Kelola stok barang masuk, keluar, dan lihat riwayat transaksi.</p>
                    </div>

                    {/* Card 1: Barang Masuk */}
                    <Link href="/karyawan/barang/masuk" className="block w-full text-left group">
                        <div className="flex items-center gap-4 rounded-xl bg-white dark:bg-[#1c1f27] p-4 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all active:scale-[0.98]">
                            {/* Icon Container */}
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                                <MdMoveToInbox className="text-3xl" />
                            </div>
                            {/* Text Content */}
                            <div className="flex flex-col flex-1 gap-1">
                                <p className="text-base font-bold leading-tight text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">Barang Masuk</p>
                                <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Catat penerimaan stok baru</p>
                            </div>
                            {/* Chevron */}
                            <div className="text-gray-400 dark:text-gray-600">
                                <MdChevronRight className="text-2xl" />
                            </div>
                        </div>
                    </Link>

                    {/* Card 2: Barang Keluar */}
                    <Link href="/karyawan/barang/keluar" className="block w-full text-left group">
                        <div className="flex items-center gap-4 rounded-xl bg-white dark:bg-[#1c1f27] p-4 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-teal-500/50 dark:hover:border-teal-500/50 transition-all active:scale-[0.98]">
                            {/* Icon Container */}
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400">
                                <MdOutbound className="text-3xl" />
                            </div>
                            {/* Text Content */}
                            <div className="flex flex-col flex-1 gap-1">
                                <p className="text-base font-bold leading-tight text-gray-900 dark:text-white group-hover:text-teal-500 transition-colors">Barang Keluar</p>
                                <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Input pengiriman barang</p>
                            </div>
                            {/* Chevron */}
                            <div className="text-gray-400 dark:text-gray-600">
                                <MdChevronRight className="text-2xl" />
                            </div>
                        </div>
                    </Link>

                    {/* Card 3: Riwayat Transaksi */}
                    <Link href="/karyawan/barang/riwayat" className="block w-full text-left group">
                        <div className="flex items-center gap-4 rounded-xl bg-white dark:bg-[#1c1f27] p-4 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all active:scale-[0.98]">
                            {/* Icon Container */}
                            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
                                <MdReceiptLong className="text-3xl" />
                            </div>
                            {/* Text Content */}
                            <div className="flex flex-col flex-1 gap-1">
                                <p className="text-base font-bold leading-tight text-gray-900 dark:text-white group-hover:text-purple-500 transition-colors">Riwayat Transaksi</p>
                                <p className="text-sm font-normal text-gray-500 dark:text-gray-400">Lihat log aktivitas stok</p>
                            </div>
                            {/* Chevron */}
                            <div className="text-gray-400 dark:text-gray-600">
                                <MdChevronRight className="text-2xl" />
                            </div>
                        </div>
                    </Link>

                    {/* Quick Stats */}
                    <div className="mt-6">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 px-1">Status Hari Ini</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-[#1c1f27] p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Masuk</p>
                                <p className="text-lg font-bold text-green-500 mt-1">+{stats.barangMasukToday}</p>
                            </div>
                            <div className="bg-white dark:bg-[#1c1f27] p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                                <p className="text-xs text-gray-500 dark:text-gray-400">Total Keluar</p>
                                <p className="text-lg font-bold text-red-500 mt-1">-{stats.barangKeluarToday}</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
