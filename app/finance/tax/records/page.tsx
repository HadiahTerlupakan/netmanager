"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiArrowPath,
    HiOutlineDocumentText,
    HiOutlinePlus,
    HiBars3,
} from 'react-icons/hi2'
import { useFinance } from '@/hooks/useFinance'
import PageLoader from '@/components/ui/PageLoader'

interface TaxRecord {
    id: string
    taxType: string
    taxPeriod: number
    taxYear: number
    taxableAmount: string
    taxAmount: string
    taxRate: number
    status: string
    reference?: string
    notes?: string
    createdAt: string
}

const formatRupiah = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

const TAX_TYPE_LABELS: Record<string, string> = {
    PPN_IN: 'PPN Masukan',
    PPN_OUT: 'PPN Keluaran',
    PPH_21: 'PPh 21',
    PPH_23: 'PPh 23',
    PPH_25: 'PPh 25',
    PPH_29: 'PPh 29',
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    CALCULATED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    FILED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    PAID: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
}

export default function TaxRecordsPage() {
    const router = useRouter()
    const { data: financeUser, loading: userLoading } = useFinance()
    const [records, setRecords] = useState<TaxRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [filterType, setFilterType] = useState<string>('all')
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })

    const fetchRecords = async (page = 1) => {
        try {
            setLoading(true)
            const token = localStorage.getItem('finance_token')

            let url = `/api/finance/tax/records?page=${page}&limit=20`
            if (filterStatus !== 'all') url += `&status=${filterStatus}`
            if (filterType !== 'all') url += `&taxType=${filterType}`

            const response = await fetch(url, {
                headers: token ? { 'x-finance-token': token } : {},
            })

            if (response.ok) {
                const data = await response.json()
                setRecords(data.data || [])
                setPagination({
                    page: data.page || 1,
                    total: data.total || 0,
                    totalPages: data.totalPages || 1,
                })
            }
        } catch (error) {
            console.error('Error fetching tax records:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRecords()
    }, [filterStatus, filterType])

    if (userLoading) {
        return <PageLoader />
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
            {/* Header */}
            <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if ((window as any).toggleFinanceSidebar) {
                                        (window as any).toggleFinanceSidebar()
                                    }
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
                            >
                                <HiBars3 className="w-6 h-6" />
                            </button>
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <HiOutlineDocumentText className="w-6 h-6" />
                            </div>
                            <h1 className="text-xl font-bold">Tax Records</h1>
                        </div>
                        <div className="flex gap-2">
                            <Link
                                href="/finance/tax/records/new"
                                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
                            >
                                <HiOutlinePlus className="w-4 h-4" />
                                Add Record
                            </Link>
                            <button
                                onClick={() => fetchRecords(pagination.page)}
                                disabled={loading}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <HiArrowPath className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-4 py-4 md:px-6 lg:px-8">
                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Filter by Status
                            </label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="all">All Status</option>
                                <option value="DRAFT">Draft</option>
                                <option value="CALCULATED">Calculated</option>
                                <option value="FILED">Filed</option>
                                <option value="PAID">Paid</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Filter by Type
                            </label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="all">All Types</option>
                                <option value="PPN_IN">PPN Masukan</option>
                                <option value="PPN_OUT">PPN Keluaran</option>
                                <option value="PPH_21">PPh 21</option>
                                <option value="PPH_23">PPh 23</option>
                                <option value="PPH_25">PPh 25</option>
                                <option value="PPH_29">PPh 29</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Records Table */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Period
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Taxable Amount
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Tax Amount
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Rate
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center">
                                            <HiArrowPath className="w-6 h-6 text-emerald-600 animate-spin mx-auto" />
                                        </td>
                                    </tr>
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                            <HiOutlineDocumentText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p>No tax records found</p>
                                            <Link
                                                href="/finance/tax/records/new"
                                                className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                            >
                                                Add First Record
                                            </Link>
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                                                    {TAX_TYPE_LABELS[record.taxType] || record.taxType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {record.taxPeriod}/{record.taxYear}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                                                {formatRupiah(record.taxableAmount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                {formatRupiah(record.taxAmount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600 dark:text-gray-400">
                                                {(record.taxRate * 100).toFixed(1)}%
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[record.status] || 'bg-gray-100'}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => fetchRecords(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => fetchRecords(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Back Link */}
                <div className="mt-6">
                    <Link
                        href="/finance/tax"
                        className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                        ← Back to Tax Dashboard
                    </Link>
                </div>
            </main>
        </div>
    )
}
