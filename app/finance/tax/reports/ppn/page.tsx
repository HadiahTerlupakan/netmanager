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

interface PPNReport {
    period: number
    year: number
    ppnIn: string
    ppnOut: string
    netPPN: string
    ppnInRecords: TaxRecord[]
    ppnOutRecords: TaxRecord[]
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

export default function PPNReportPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [report, setReport] = useState<PPNReport | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const currentMonth = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const currentYear = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

    useEffect(() => {
        fetchReport()
    }, [currentMonth, currentYear])

    const fetchReport = async () => {
        try {
            setLoading(true)
            setError(null)

            const token = localStorage.getItem('finance_token')
            const response = await fetch(
                `/api/finance/tax/reports/ppn?month=${currentMonth}&year=${currentYear}`,
                {
                    headers: { 'x-finance-token': token || '' },
                }
            )

            if (!response.ok) {
                throw new Error('Failed to fetch PPN report')
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

        router.push(`/finance/tax/reports/ppn?month=${newMonth}&year=${newYear}`)
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

    const ppnIn = parseFloat(report.ppnIn)
    const ppnOut = parseFloat(report.ppnOut)
    const netPPN = parseFloat(report.netPPN)

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
                            <h1 className="text-2xl font-bold text-gray-900">Laporan PPN Bulanan</h1>
                        </div>

                        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            <HiDocumentArrowDown className="h-5 w-5 mr-2" />
                            Export PDF
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Period Selector */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => changePeriod(-1)}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            ← Bulan Sebelumnya
                        </button>

                        <div className="flex items-center space-x-2 text-lg font-semibold text-gray-900">
                            <HiCalendar className="h-6 w-6 text-blue-600" />
                            <span>{MONTHS[currentMonth - 1]} {currentYear}</span>
                        </div>

                        <button
                            onClick={() => changePeriod(1)}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Bulan Berikutnya →
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* PPN IN */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">PPN Masukan (IN)</p>
                                <p className="text-2xl font-bold text-gray-900 mt-2">
                                    {formatRupiah(ppnIn)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {report.ppnInRecords.length} transaksi
                                </p>
                            </div>
                            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">📥</span>
                            </div>
                        </div>
                    </div>

                    {/* PPN OUT */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">PPN Keluaran (OUT)</p>
                                <p className="text-2xl font-bold text-gray-900 mt-2">
                                    {formatRupiah(ppnOut)}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    {report.ppnOutRecords.length} transaksi
                                </p>
                            </div>
                            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">📤</span>
                            </div>
                        </div>
                    </div>

                    {/* Net PPN */}
                    <div className={`rounded-lg shadow-sm border p-6 ${netPPN > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                        }`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">PPN Kurang/(Lebih) Bayar</p>
                                <p className={`text-2xl font-bold mt-2 ${netPPN > 0 ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                    {formatRupiah(Math.abs(netPPN))}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                    {netPPN > 0 ? 'Harus dibayar' : 'Lebih bayar'}
                                </p>
                            </div>
                            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${netPPN > 0 ? 'bg-green-200' : 'bg-red-200'
                                }`}>
                                <span className="text-2xl">{netPPN > 0 ? '💸' : '💰'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PPN IN Records */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">
                            PPN Masukan (IN) - {report.ppnInRecords.length} Transaksi
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Tanggal
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Referensi
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        DPP
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        PPN 11%
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {report.ppnInRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                                            Tidak ada transaksi PPN IN
                                        </td>
                                    </tr>
                                ) : (
                                    report.ppnInRecords.map((record) => (
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
                            {report.ppnInRecords.length > 0 && (
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                                            Total:
                                        </td>
                                        <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                                            {formatRupiah(ppnIn)}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* PPN OUT Records */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">
                            PPN Keluaran (OUT) - {report.ppnOutRecords.length} Transaksi
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Tanggal
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Referensi
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        DPP
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        PPN 11%
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {report.ppnOutRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                                            Tidak ada transaksi PPN OUT
                                        </td>
                                    </tr>
                                ) : (
                                    report.ppnOutRecords.map((record) => (
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
                            {report.ppnOutRecords.length > 0 && (
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                                            Total:
                                        </td>
                                        <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">
                                            {formatRupiah(ppnOut)}
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
                            Kesimpulan Laporan PPN {MONTHS[currentMonth - 1]} {currentYear}
                        </p>
                        <p className="text-lg text-gray-900">
                            {netPPN > 0 ? (
                                <>
                                    PPN yang harus dibayar ke negara: <span className="font-bold text-green-700">{formatRupiah(netPPN)}</span>
                                </>
                            ) : (
                                <>
                                    PPN lebih bayar (dapat dikreditkan): <span className="font-bold text-red-700">{formatRupiah(Math.abs(netPPN))}</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
