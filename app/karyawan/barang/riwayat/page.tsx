'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import {
    MdArrowBack,
    MdAdd,
    MdRemove,
    MdFilterList
} from 'react-icons/md'
import Link from 'next/link'

interface Transaction {
    id: string
    type: 'masuk' | 'keluar'
    barang: {
        kode: string
        nama: string
        satuan: string
    }
    gudang: {
        nama: string
    }
    jumlah: number
    kondisi: string
    keterangan: string | null
    tanggal: string
}

export default function RiwayatBarangPage() {
    const { isLoading: authLoading, isAuthenticated } = useKaryawanAuth()
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'masuk' | 'keluar'>('all')
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/karyawan/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (isAuthenticated) {
            fetchRiwayat()
        }
    }, [isAuthenticated])

    const fetchRiwayat = async () => {
        try {
            const res = await fetch('/api/karyawan/barang/riwayat')
            if (res.ok) {
                const data = await res.json()
                setTransactions(data.transactions || [])
            }
        } catch (error) {
            console.error('Failed to fetch riwayat:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const filteredTransactions = transactions.filter(t =>
        filter === 'all' || t.type === filter
    )

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (authLoading || isLoading) {
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
                        <Link href="/karyawan/barang" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <MdArrowBack className="text-2xl" />
                        </Link>
                        <h2 className="text-lg font-bold leading-tight">Riwayat Transaksi</h2>
                        <div className="w-10" />
                    </div>

                    {/* Filter */}
                    <div className="flex px-4 pb-3 gap-2">
                        {(['all', 'masuk', 'keluar'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${filter === f
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white dark:bg-[#1c2936] text-gray-600 dark:text-gray-400'
                                    }`}
                            >
                                {f === 'all' ? 'Semua' : f === 'masuk' ? 'Masuk' : 'Keluar'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 pb-24 px-4 pt-4">
                    {filteredTransactions.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            Belum ada transaksi
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredTransactions.map(t => (
                                <div key={t.id} className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.type === 'masuk'
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                                            }`}>
                                            {t.type === 'masuk' ? <MdAdd className="text-xl" /> : <MdRemove className="text-xl" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-semibold dark:text-white truncate">{t.barang.nama}</p>
                                                    <p className="text-xs text-gray-500">{t.barang.kode}</p>
                                                </div>
                                                <span className={`text-sm font-bold ${t.type === 'masuk' ? 'text-green-600' : 'text-orange-600'
                                                    }`}>
                                                    {t.type === 'masuk' ? '+' : '-'}{t.jumlah} {t.barang.satuan}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                                <span>{t.gudang.nama}</span>
                                                <span>•</span>
                                                <span>{t.kondisi}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-gray-400">{formatDate(t.tanggal)}</p>
                                            {t.keterangan && (
                                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t.keterangan}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
