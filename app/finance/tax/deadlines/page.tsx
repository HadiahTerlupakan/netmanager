"use client"

import { useEffect, useState } from 'react'
import { HiCalendar, HiCheckCircle, HiClock, HiExclamationTriangle } from 'react-icons/hi2'
import Link from 'next/link'

interface TaxDeadline {
    id: string
    taxType: string
    period: number
    year: number
    deadline: string
    status: 'PENDING' | 'FILED' | 'LATE'
    filedAt: string | null
    notes: string | null
}

const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })
}

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
]

const TAX_TYPE_LABELS: Record<string, string> = {
    'PPN': 'PPN (Pajak Pertambahan Nilai)',
    'PPH_21': 'PPh 21 (Gaji Karyawan)',
    'PPH_23': 'PPh 23 (Jasa)',
    'PPH_4_2': 'PPh 4(2) (Sewa)',
}

export default function TaxDeadlinePage() {
    const [deadlines, setDeadlines] = useState<TaxDeadline[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'pending' | 'upcoming'>('upcoming')
    const currentYear = new Date().getFullYear()

    useEffect(() => {
        fetchDeadlines()
    }, [])

    const fetchDeadlines = async () => {
        try {
            setLoading(true)
            const token = localStorage.getItem('finance_token')
            const response = await fetch(`/api/finance/tax/deadlines?year=${currentYear}`, {
                headers: { 'x-finance-token': token || '' },
            })

            if (response.ok) {
                const data = await response.json()
                setDeadlines(data)
            }
        } catch (error) {
            console.error('Error fetching deadlines:', error)
        } finally {
            setLoading(false)
        }
    }

    const markAsFiled = async (id: string) => {
        try {
            const token = localStorage.getItem('finance_token')
            const response = await fetch(`/api/finance/tax/deadlines/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-finance-token': token || '',
                },
                body: JSON.stringify({
                    filedBy: 'current-user', // TODO: get from auth
                    notes: 'Marked as filed from UI',
                }),
            })

            if (response.ok) {
                fetchDeadlines() // Refresh
            }
        } catch (error) {
            console.error('Error marking deadline:', error)
        }
    }

    const getFilteredDeadlines = () => {
        const now = new Date()
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        switch (filter) {
            case 'pending':
                return deadlines.filter(d => d.status === 'PENDING')
            case 'upcoming':
                return deadlines.filter(d => {
                    const deadline = new Date(d.deadline)
                    return d.status === 'PENDING' && deadline <= thirtyDaysFromNow
                })
            default:
                return deadlines
        }
    }

    const filteredDeadlines = getFilteredDeadlines()

    // Group by month
    const deadlinesByMonth = filteredDeadlines.reduce((acc, deadline) => {
        const month = new Date(deadline.deadline).getMonth()
        if (!acc[month]) acc[month] = []
        acc[month].push(deadline)
        return acc
    }, {} as Record<number, TaxDeadline[]>)

    const getStatusColor = (deadline: TaxDeadline) => {
        if (deadline.status === 'FILED') return 'text-green-600 bg-green-50'
        if (deadline.status === 'LATE') return 'text-red-600 bg-red-50'

        const now = new Date()
        const deadlineDate = new Date(deadline.deadline)
        const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (daysUntil < 0) return 'text-red-600 bg-red-50'
        if (daysUntil <= 7) return 'text-orange-600 bg-orange-50'
        return 'text-blue-600 bg-blue-50'
    }

    const getStatusIcon = (deadline: TaxDeadline) => {
        if (deadline.status === 'FILED') return <HiCheckCircle className="h-5 w-5" />

        const now = new Date()
        const deadlineDate = new Date(deadline.deadline)
        const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (daysUntil < 0) return <HiExclamationTriangle className="h-5 w-5" />
        return <HiClock className="h-5 w-5" />
    }

    const getDaysUntil = (deadlineStr: string) => {
        const now = new Date()
        const deadline = new Date(deadlineStr)
        const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (daysUntil < 0) return `Terlambat ${Math.abs(daysUntil)} hari`
        if (daysUntil === 0) return 'Hari ini!'
        if (daysUntil === 1) return 'Besok'
        return `${daysUntil} hari lagi`
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Memuat deadline...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Tax Filing Deadlines</h1>
                            <p className="text-sm text-gray-600 mt-1">Jadwal pelaporan pajak tahun {currentYear}</p>
                        </div>
                        <Link
                            href="/finance/tax"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Kembali
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('upcoming')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'upcoming'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Upcoming (30 hari)
                        </button>
                        <button
                            onClick={() => setFilter('pending')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'pending'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Belum Lapor
                        </button>
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${filter === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Semua
                        </button>
                    </div>
                </div>

                {/* Deadlines by Month */}
                {Object.keys(deadlinesByMonth).length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                        <HiCalendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">Tidak ada deadline untuk filter ini</p>
                    </div>
                ) : (
                    Object.entries(deadlinesByMonth)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([monthStr, monthDeadlines]) => {
                            const month = parseInt(monthStr)
                            return (
                                <div key={month} className="mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                                        <HiCalendar className="h-5 w-5 mr-2 text-blue-600" />
                                        {MONTHS[month]} {currentYear}
                                    </h2>
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
                                        {monthDeadlines.map((deadline) => (
                                            <div key={deadline.id} className="p-4 hover:bg-gray-50 transition">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${getStatusColor(deadline)}`}>
                                                                {getStatusIcon(deadline)}
                                                            </div>
                                                            <div>
                                                                <h3 className="font-medium text-gray-900">
                                                                    {TAX_TYPE_LABELS[deadline.taxType] || deadline.taxType}
                                                                </h3>
                                                                <p className="text-sm text-gray-600">
                                                                    Periode {MONTHS[deadline.period - 1]} {deadline.year}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-4">
                                                        <div className="text-right">
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {formatDate(deadline.deadline)}
                                                            </p>
                                                            <p className={`text-xs ${deadline.status === 'FILED'
                                                                    ? 'text-green-600'
                                                                    : new Date(deadline.deadline) < new Date()
                                                                        ? 'text-red-600'
                                                                        : 'text-gray-600'
                                                                }`}>
                                                                {deadline.status === 'FILED'
                                                                    ? 'Sudah dilaporkan'
                                                                    : getDaysUntil(deadline.deadline)
                                                                }
                                                            </p>
                                                        </div>

                                                        {deadline.status === 'PENDING' && (
                                                            <button
                                                                onClick={() => markAsFiled(deadline.id)}
                                                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                                            >
                                                                Tandai Selesai
                                                            </button>
                                                        )}

                                                        {deadline.status === 'FILED' && (
                                                            <span className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg">
                                                                ✓ Selesai
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })
                )}
            </div>
        </div>
    )
}
