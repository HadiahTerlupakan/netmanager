"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    HiArrowPath,
    HiCalendar,
    HiCheckCircle,
    HiClock,
    HiCurrencyDollar,
    HiDocumentCheck,
    HiPlus,
} from 'react-icons/hi2'
import Link from 'next/link'

interface USOContribution {
    id: string
    quarter: number
    year: number
    totalRevenue: string
    usoRate: number
    usoAmount: string
    status: string
    calculatedAt?: string
    filedAt?: string
    paidAt?: string
}

const formatRupiah = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    CALCULATED: 'bg-blue-100 text-blue-700',
    FILED: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
}

const STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Draft',
    CALCULATED: 'Calculated',
    FILED: 'Filed',
    PAID: 'Paid',
}

export default function USODashboardPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [contributions, setContributions] = useState<USOContribution[]>([])
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [calculating, setCalculating] = useState(false)

    useEffect(() => {
        fetchContributions()
    }, [selectedYear])

    const fetchContributions = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/finance/uso?year=${selectedYear}`)
            if (response.ok) {
                const data = await response.json()
                setContributions(data)
            }
        } catch (error) {
            console.error('Error fetching USO contributions:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateQuarter = async (quarter: number) => {
        try {
            setCalculating(true)
            const response = await fetch('/api/finance/uso/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quarter,
                    year: selectedYear,
                    createdBy: 'admin', // TODO: get from auth
                }),
            })

            if (response.ok) {
                await fetchContributions()
            } else {
                const error = await response.json()
                alert(error.error || 'Failed to calculate USO')
            }
        } catch (error) {
            console.error('Error calculating USO:', error)
            alert('Failed to calculate USO')
        } finally {
            setCalculating(false)
        }
    }

    const markAsFiled = async (id: string) => {
        try {
            const response = await fetch(`/api/finance/uso/${id}/file`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filedBy: 'admin' }), // TODO: get from auth
            })

            if (response.ok) {
                await fetchContributions()
            }
        } catch (error) {
            console.error('Error filing USO:', error)
        }
    }

    const markAsPaid = async (id: string) => {
        try {
            const response = await fetch(`/api/finance/uso/${id}/pay`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paidBy: 'admin' }), // TODO: get from auth
            })

            if (response.ok) {
                await fetchContributions()
            }
        } catch (error) {
            console.error('Error paying USO:', error)
        }
    }

    // Group by quarter
    const quarterData: Record<number, USOContribution | undefined> = {}
    contributions.forEach((c) => {
        quarterData[c.quarter] = c
    })

    const getQuarterIcon = (status?: string) => {
        if (!status) return <HiClock className="h-6 w-6 text-gray-400" />
        switch (status) {
            case 'PAID':
                return <HiCheckCircle className="h-6 w-6 text-green-600" />
            case 'FILED':
                return <HiDocumentCheck className="h-6 w-6 text-yellow-600" />
            case 'CALCULATED':
                return <HiCurrencyDollar className="h-6 w-6 text-blue-600" />
            default:
                return <HiClock className="h-6 w-6 text-gray-400" />
        }
    }

    const yearTotal = contributions.reduce(
        (sum, c) => sum + parseFloat(c.usoAmount),
        0
    )

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <HiArrowPath className="h-8 w-8 text-emerald-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">BHP & USO Contribution</h1>
                        <p className="text-sm text-gray-600">
                            Biaya Hak Penyelenggaraan & Kontribusi Kewajiban Pelayanan Universal - 1.25% dari Revenue per Kuartal
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="px-4 py-2 border border-gray-300 rounded-lg"
                        >
                            {[2024, 2025, 2026].map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Quarterly Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {[1, 2, 3, 4].map((quarter) => {
                    const data = quarterData[quarter]
                    return (
                        <div
                            key={quarter}
                            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Q{quarter}</h3>
                                {getQuarterIcon(data?.status)}
                            </div>

                            {data ? (
                                <>
                                    <div className="mb-3">
                                        <p className="text-xs text-gray-600">Revenue</p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {formatRupiah(data.totalRevenue)}
                                        </p>
                                    </div>
                                    <div className="mb-3">
                                        <p className="text-xs text-gray-600">USO (1.25%)</p>
                                        <p className="text-lg font-bold text-emerald-600">
                                            {formatRupiah(data.usoAmount)}
                                        </p>
                                    </div>
                                    <div>
                                        <span
                                            className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[data.status] || 'bg-gray-100'
                                                }`}
                                        >
                                            {STATUS_LABELS[data.status] || data.status}
                                        </span>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="mt-4 space-y-2">
                                        {data.status === 'CALCULATED' && (
                                            <button
                                                onClick={() => markAsFiled(data.id)}
                                                className="w-full text-xs px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                                            >
                                                Mark as Filed
                                            </button>
                                        )}
                                        {data.status === 'FILED' && (
                                            <button
                                                onClick={() => markAsPaid(data.id)}
                                                className="w-full text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                                            >
                                                Mark as Paid
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <button
                                    onClick={() => calculateQuarter(quarter)}
                                    disabled={calculating}
                                    className="w-full mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {calculating ? (
                                        <HiArrowPath className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <HiPlus className="h-4 w-4" />
                                    )}
                                    Calculate
                                </button>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Year Summary */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-md p-6 text-white mb-8">
                <h3 className="text-lg font-semibold mb-2">Total BHP USO {selectedYear}</h3>
                <p className="text-3xl font-bold">{formatRupiah(yearTotal)}</p>
                <p className="text-sm text-white/80 mt-2">
                    {contributions.filter((c) => c.status === 'PAID').length} dari 4 kuartal sudah dibayar
                </p>
            </div>

            {/* Contributions Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Contribution History</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Period
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Revenue
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Rate
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    USO Amount
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Filed Date
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Paid Date
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {contributions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                        No USO contributions for {selectedYear}. Click "Calculate" above to get started.
                                    </td>
                                </tr>
                            ) : (
                                contributions.map((c) => (
                                    <tr key={c.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            Q{c.quarter} {c.year}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                            {formatRupiah(c.totalRevenue)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                                            {(c.usoRate * 100).toFixed(2)}%
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-emerald-600">
                                            {formatRupiah(c.usoAmount)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span
                                                className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[c.status] || 'bg-gray-100'
                                                    }`}
                                            >
                                                {STATUS_LABELS[c.status] || c.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                                            {c.filedAt
                                                ? new Date(c.filedAt).toLocaleDateString('id-ID')
                                                : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                                            {c.paidAt
                                                ? new Date(c.paidAt).toLocaleDateString('id-ID')
                                                : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    Tentang BHP & USO
                </h4>
                <p className="text-sm text-blue-800 mb-2">
                    <strong>BHP USO</strong> adalah singkatan dari <strong>Biaya Hak Penyelenggaraan (BHP) Telekomunikasi</strong> dan <strong>Kontribusi Kewajiban Pelayanan Universal (USO)</strong> di Indonesia.
                </p>
                <p className="text-sm text-blue-800">
                    Merupakan iuran wajib dari penyelenggara telekomunikasi sebesar 1.25% dari revenue kotor per kuartal untuk penerimaan negara. Dana ini digunakan untuk mengembangkan infrastruktur telekomunikasi di seluruh Indonesia, membantu pemerataan layanan, dan mendukung pertumbuhan teknologi informasi.
                </p>
            </div>
        </div>
    )
}
