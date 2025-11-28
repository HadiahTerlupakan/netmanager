"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HiArrowLeft, HiDocumentArrowDown, HiCalendar } from 'react-icons/hi2'
import Link from 'next/link'

interface TaxRecord {
    id: string
    taxType: string
    taxPeriod: number
    taxYear: number
    taxableAmount: string
    taxAmount: string
    reference: string | null
    createdAt: string
}

interface PPHReport {
    period: number
    year: number
    taxType: string
    pphRecords: TaxRecord[]
    totalTaxableAmount: string
    totalTaxAmount: string
    averageRate: number
}

const formatRupiah = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(numAmount)
}

const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

const PPH_TYPES = [
    { value: 'PPH_21', label: 'PPh 21 (Gaji Karyawan)' },
    { value: 'PPH_23', label: 'PPh 23 (Jasa)' },
    { value: 'PPH_4_2', label: 'PPh 4(2) (Sewa)' },
]

export default function PPHReportPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [report, setReport] = useState<PPHReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const currentMonth = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const currentYear = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
    const currentType = searchParams.get('type') || 'PPH_21'

    useEffect(() => {
        fetchReport()
    }, [currentMonth, currentYear, currentType])

    const fetchReport = async () => {
        try {
            setLoading(true)
            setError(null)

            const token = localStorage.getItem('finance_token')
            const response = await fetch(
                `/api/finance/tax/reports/pph?month=${currentMonth}&year=${currentYear}&type=${currentType}`,
                {
                    headers: { 'x-finance-token': token || '' },
                }
            )

            if (!response.ok) {
                throw new Error('Failed to fetch PPh report')
            }

            const data = await response.json()
            setReport(data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const changePeriod = (monthDelta: number) => {
        let newMonth = currentMonth + monthDelta
        let newYear = currentYear

        if (newMonth > 12) {
            newMonth = 1
            newYear++
        } else if (newMonth < 1) {
            newMonth = 12
            newYear--
        }

        router.push(`/finance/tax/reports/pph?month=${newMonth}&year=${newYear}&type=${currentType}`)
    }

    const changeType = (type: string) => {
        router.push(`/finance/tax/reports/pph?month=${currentMonth}&year=${currentYear}&type=${type}`)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Memuat laporan...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <p className="text-red-600">Error: {error}</p>
                        <button
                            onClick={fetchReport}
                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                            Coba Lagi
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (!report) return null

    const totalTaxable = parseFloat(report.totalTaxableAmount)
    const totalTax = parseFloat(report.totalTaxAmount)
    const typeLabel = PPH_TYPES.find(t => t.value === currentType)?.label || currentType

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Link
                                href="/finance/tax"
                                className="flex items-center text-gray-600 hover:text-gray-900"
                            >
                                <HiArrowLeft className="h-5 w-5 mr-2" />
                                Kembali
                            </Link>
                            <div className="h-6 w-px bg-gray-300" />
                            <h1 className="text-2xl font-bold text-gray-900">Laporan PPh Bulanan</h1>
                        </div>

                        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            <HiDocumentArrowDown className="h-5 w-5 mr-2" />
                            Export PDF
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Period & Type Selector */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => changePeriod(-1)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                ← Prev
                            </button>

                            <div className="flex items-center space-x-2 text-lg font-semibold text-gray-900 px-4">
                                <HiCalendar className="h-6 w-6 text-blue-600" />
                                <span>{MONTHS[currentMonth - 1]} {currentYear}</span>
                            </div>

                            <button
                                onClick={() => changePeriod(1)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Next →
                            </button>
                        </div>

                        {/* Type Selector */}
                        <div className="flex gap-2">
                            {PPH_TYPES.map((type) => (
                                <button
                                    key={type.value}
                                    onClick={() => changeType(type.value)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${currentType === type.value
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {type.value.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <p className="text-sm font-medium text-gray-600">Jenis Pajak</p>
                        <p className="text-xl font-bold text-gray-900 mt-2">{typeLabel}</p>
                        <p className="text-xs text-gray-500 mt-1">{report.pphRecords.length} transaksi</p>
                    </div>

                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <p className="text-sm font-medium text-gray-600">Total DPP</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">{formatRupiah(totalTaxable)}</p>
                        <p className="text-xs text-gray-500 mt-1">Dasar Pengenaan Pajak</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-sm p-6 text-white">
                        <p className="text-sm font-medium text-white/80">Total PPh</p>
                        <p className="text-2xl font-bold mt-2">{formatRupiah(totalTax)}</p>
                        <p className="text-xs text-white/80 mt-1">
                            Rate: {(report.averageRate * 100).toFixed(2)}%
                        </p>
                    </div>
                </div>

                {/* PPh Records Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Transaksi {typeLabel} - {report.pphRecords.length} Record
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Tanggal
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Referensi
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        DPP
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Pajak
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {report.pphRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                            Tidak ada transaksi {typeLabel} pada periode ini
                                        </td>
                                    </tr>
                                ) : (
                                    report.pphRecords.map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {new Date(record.createdAt).toLocaleDateString('id-ID')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {record.reference || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                                                {formatRupiah(record.taxableAmount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                                                {formatRupiah(record.taxAmount)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            {report.pphRecords.length > 0 && (
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan={2} className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                                            Total:
                                        </td>
                                        <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                                            {formatRupiah(totalTaxable)}
                                        </td>
                                        <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                                            {formatRupiah(totalTax)}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* Summary Footer */}
                <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">
                            Kesimpulan Laporan {typeLabel} - {MONTHS[currentMonth - 1]} {currentYear}
                        </p>
                        <p className="text-lg text-gray-900">
                            Total pajak yang harus dipotong/dibayar: <span className="font-bold text-purple-700">{formatRupiah(totalTax)}</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
