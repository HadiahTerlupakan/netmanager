"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    HiOutlineCurrencyDollar,
    HiOutlineDocumentText,
    HiOutlineCalendar,
    HiOutlineExclamationCircle,
    HiOutlineCheckCircle,
    HiArrowPath,
    HiPlus,
} from 'react-icons/hi2'
import Link from 'next/link'

const formatRupiah = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseInt(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

export default function TaxDashboardPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [ppnReport, setPpnReport] = useState<any>(null)
    const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([])
    const [recentRecords, setRecentRecords] = useState<any[]>([])

    // Current period
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth() + 1
    const currentYear = currentDate.getFullYear()

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            const currentDate = new Date()
            const month = currentDate.getMonth() + 1
            const year = currentDate.getFullYear()

            // Fetch PPN report for current month
            const ppnRes = await fetch(`/api/finance/tax/reports/ppn?month=${month}&year=${year}`)
            if (ppnRes.ok) {
                const data = await ppnRes.json()
                setPpnReport(data)
            }

            // Fetch recent tax records
            const recordsRes = await fetch(`/api/finance/tax/records?limit=10`)
            if (recordsRes.ok) {
                const data = await recordsRes.json()
                setRecentRecords(data.data || [])
            }

            // TODO: Fetch upcoming deadlines when API is ready
            // For now, use mock data
            setUpcomingDeadlines([])
        } catch (error) {
            console.error('Error fetching tax data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <HiArrowPath className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tax Management</h1>
                <p className="text-gray-500 dark:text-gray-400">Manage tax records and reporting</p>
            </div>

            {/* Quick Actions (New structure) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <button
                    onClick={() => router.push("/finance/tax/records/new")} // Changed to router.push for navigation
                    className="flex items-center justify-center px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
                >
                    <HiPlus className="h-5 w-5 mr-2" />
                    Tambah Catatan Pajak
                </button>
                <Link
                    href={`/finance/tax/reports/ppn?month=${currentMonth}&year=${currentYear}`}
                    className="flex items-center justify-center px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm"
                >
                    <HiOutlineDocumentText className="h-5 w-5 mr-2" /> {/* Changed to HiOutlineDocumentText */}
                    Lihat Laporan PPN
                </Link>
            </div>

            {/* PPN Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* PPN IN */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        PPN IN (Masukan)
                    </h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {ppnReport ? formatRupiah(ppnReport.ppnIn) : formatRupiah(0)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {ppnReport?.ppnInRecords?.length || 0} transaksi
                    </p>
                </div>

                {/* PPN OUT */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        PPN OUT (Keluaran)
                    </h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {ppnReport ? formatRupiah(ppnReport.ppnOut) : formatRupiah(0)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {ppnReport?.ppnOutRecords?.length || 0} transaksi
                    </p>
                </div>

                {/* Net PPN */}
                <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-md p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-white/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-white/80 mb-1">Net PPN (Kurang Bayar)</h3>
                    <p className="text-2xl font-bold">
                        {ppnReport ? formatRupiah(ppnReport.netPPN) : formatRupiah(0)}
                    </p>
                    <p className="text-xs text-white/80 mt-1">
                        Periode: {ppnReport?.period || '-'}/{ppnReport?.year || '-'}
                    </p>
                </div>
            </div>

            {/* Quick Actions & Recent Records */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Quick Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Quick Actions
                    </h3>
                    <div className="space-y-3">
                        <Link
                            href="/finance/tax/records/new"
                            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                                <HiOutlineDocumentText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">Add Tax Record</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Record new tax transaction
                                </p>
                            </div>
                        </Link>

                        <Link
                            href="/finance/tax/reports/ppn"
                            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                                <HiOutlineDocumentText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">PPN Report</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    View monthly PPN report
                                </p>
                            </div>
                        </Link>

                        <Link
                            href="/finance/tax/records"
                            className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                                <HiOutlineCalendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-white">All Tax Records</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    View and manage all records
                                </p>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Recent Records */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Recent Tax Records
                        </h3>
                        <Link
                            href="/finance/tax/records"
                            className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                            View All
                        </Link>
                    </div>

                    <div className="space-y-3">
                        {recentRecords.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                <HiOutlineDocumentText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No tax records yet</p>
                            </div>
                        ) : (
                            recentRecords.slice(0, 5).map((record) => (
                                <div
                                    key={record.id}
                                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                                                {record.taxType}
                                            </span>
                                            <span className="text-sm text-gray-900 dark:text-white font-medium">
                                                {record.taxPeriod}/{record.taxYear}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            {formatRupiah(record.taxAmount)}
                                        </p>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-1 rounded ${record.status === 'FILED'
                                            ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                            : record.status === 'PAID'
                                                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                            }`}
                                    >
                                        {record.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
