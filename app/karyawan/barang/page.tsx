'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import {
    MdArrowBack,
    MdAdd,
    MdRemove,
    MdHistory
} from 'react-icons/md'
import Link from 'next/link'

export default function BarangIndexPage() {
    const { isLoading: authLoading, isAuthenticated } = useKaryawanAuth()
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/karyawan/login')
        }
    }, [authLoading, isAuthenticated, router])

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased">
            <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">

                {/* Header */}
                <div className="sticky top-0 z-20 bg-[#f6f7f8] dark:bg-[#101922] border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center p-4 justify-between">
                        <Link href="/karyawan/dashboard" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <MdArrowBack className="text-2xl" />
                        </Link>
                        <h2 className="text-lg font-bold leading-tight">Barang</h2>
                        <div className="w-10" />
                    </div>
                </div>

                {/* Menu */}
                <div className="flex-1 pb-24 px-4 pt-6">
                    <div className="space-y-4">
                        <Link href="/karyawan/barang/masuk">
                            <div className="bg-white dark:bg-[#1c2936] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-green-500/50 transition-colors flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <MdAdd className="text-3xl text-green-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg dark:text-white">Barang Masuk</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Input stok barang baru</p>
                                </div>
                            </div>
                        </Link>

                        <Link href="/karyawan/barang/keluar">
                            <div className="bg-white dark:bg-[#1c2936] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-orange-500/50 transition-colors flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                    <MdRemove className="text-3xl text-orange-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg dark:text-white">Barang Keluar</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Ambil stok barang</p>
                                </div>
                            </div>
                        </Link>

                        <Link href="/karyawan/barang/riwayat">
                            <div className="bg-white dark:bg-[#1c2936] rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-purple-500/50 transition-colors flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <MdHistory className="text-3xl text-purple-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg dark:text-white">Riwayat Transaksi</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Lihat histori barang Anda</p>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
