"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
    HiOutlineDocumentText,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineCurrencyDollar,
    HiOutlineChartBar,
    HiOutlineCalendar,
    HiOutlinePlus,
    HiMagnifyingGlass,
    HiAdjustmentsHorizontal,
    HiArrowDownTray,
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

type TagihanStatus = 'BELUM_LUNAS' | 'LUNAS' | 'TERLAMBAT'

interface TagihanItem {
    id: string
    noTagihan: string
    pelangganNama: string
    pelangganId: string
    total: number
    status: TagihanStatus
    jatuhTempo: string
    createdAt: string
}

interface Stats {
    total: number
    belumLunas: number
    lunas: number
    terlambat: number
    totalNominalBelumLunas: number
    totalNominalLunas: number
    totalNominalTerlambat: number
    mrr: number
    conversionRate: number
    overdueCount: number
}

export default function TagihanPage() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [recentTagihan, setRecentTagihan] = useState<TagihanItem[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | TagihanStatus>('all')
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/tagihan/stats')
            if (!response.ok) throw new Error('Failed to fetch stats')

            const data = await response.json()
            setStats(data.stats)
            setRecentTagihan(data.recentTagihan)
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatRupiah = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    const getStatusBadge = (status: TagihanStatus) => {
        const styles = {
            LUNAS: 'bg-green-100 text-green-800',
            BELUM_LUNAS: 'bg-yellow-100 text-yellow-800',
            TERLAMBAT: 'bg-red-100 text-red-800',
        }

        const icons = {
            LUNAS: HiOutlineCheckCircle,
            BELUM_LUNAS: HiOutlineClock,
            TERLAMBAT: HiOutlineXCircle,
        }

        const labels = {
            LUNAS: 'Lunas',
            BELUM_LUNAS: 'Belum Lunas',
            TERLAMBAT: 'Terlambat',
        }

        const Icon = icons[status]

        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
                <Icon className="w-4 h-4" />
                {labels[status]}
            </span>
        )
    }

    if (loading) {
        return <PageLoader />
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tagihan</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Kelola tagihan dan pembayaran pelanggan
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/admin/finance/tagihan/generate"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
                    >
                        <HiOutlinePlus className="w-5 h-5" />
                        Generate Tagihan
                    </Link>
                </div>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Total Tagihan */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Tagihan</p>
                                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
                                <p className="text-xs text-gray-500 mt-1">Semua periode</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <HiOutlineDocumentText className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    {/* Belum Lunas */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Belum Lunas</p>
                                <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.belumLunas}</p>
                                <p className="text-xs text-gray-500 mt-1">{formatRupiah(stats.totalNominalBelumLunas)}</p>
                            </div>
                            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <HiOutlineClock className="w-6 h-6 text-yellow-600" />
                            </div>
                        </div>
                    </div>

                    {/* Lunas */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Lunas</p>
                                <p className="text-2xl font-bold text-green-600 mt-2">{stats.lunas}</p>
                                <p className="text-xs text-gray-500 mt-1">{formatRupiah(stats.totalNominalLunas)}</p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                    </div>

                    {/* MRR */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">MRR</p>
                                <p className="text-2xl font-bold text-sky-600 mt-2">{formatRupiah(stats.mrr)}</p>
                                <p className="text-xs text-gray-500 mt-1">Bulan ini</p>
                            </div>
                            <div className="w-12 h-12 bg-sky-100 rounded-lg flex items-center justify-center">
                                <HiOutlineCurrencyDollar className="w-6 h-6 text-sky-600" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filters and Search */}
            <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <HiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Cari nomor tagihan atau nama pelanggan..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filter === 'all'
                                ? 'bg-sky-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Semua
                        </button>
                        <button
                            onClick={() => setFilter('BELUM_LUNAS')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filter === 'BELUM_LUNAS'
                                ? 'bg-yellow-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Belum Lunas
                        </button>
                        <button
                            onClick={() => setFilter('LUNAS')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filter === 'LUNAS'
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Lunas
                        </button>
                        <button
                            onClick={() => setFilter('TERLAMBAT')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filter === 'TERLAMBAT'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Terlambat
                        </button>
                    </div>
                </div>
            </div>

            {/* Recent Tagihan Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Tagihan Terbaru</h2>
                    <p className="text-sm text-gray-500 mt-1">10 tagihan terakhir yang dibuat</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    No. Tagihan
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Pelanggan
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Total
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Jatuh Tempo
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Aksi
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {recentTagihan
                                .filter((t) => filter === 'all' || t.status === filter)
                                .filter((t) =>
                                    searchQuery === '' ||
                                    t.noTagihan.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    t.pelangganNama.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                                .map((tagihan) => (
                                    <tr key={tagihan.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link
                                                href={`/admin/finance/tagihan/${tagihan.id}`}
                                                className="text-sm font-medium text-sky-600 hover:text-sky-700"
                                            >
                                                {tagihan.noTagihan}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{tagihan.pelangganNama}</div>
                                            <div className="text-xs text-gray-500">{tagihan.pelangganId}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{formatRupiah(tagihan.total)}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900">{formatDate(tagihan.jatuhTempo)}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(tagihan.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/admin/finance/tagihan/${tagihan.id}`}
                                                    className="text-sky-600 hover:text-sky-700 font-medium"
                                                >
                                                    Detail
                                                </Link>
                                                <span className="text-gray-300">|</span>
                                                <a
                                                    href={`/api/tagihan/${tagihan.id}/pdf`}
                                                    className="text-gray-600 hover:text-gray-700 font-medium"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    PDF
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                    {recentTagihan.filter((t) => filter === 'all' || t.status === filter).length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <HiOutlineDocumentText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                            <p>Tidak ada tagihan yang ditemukan</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
