"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
    HiOutlineArrowPath,
    HiBars3,
    HiOutlineDocumentChartBar,
    HiOutlineArrowTrendingUp,
    HiOutlineArrowTrendingDown,
    HiOutlineMinusCircle,
} from 'react-icons/hi2'

const formatRupiah = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? Number(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(numAmount)
}

export default function AdminFinanceReports() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [activeReport, setActiveReport] = useState<'pl' | 'cashflow' | 'balance-sheet'>('pl')
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear] = useState(new Date().getFullYear())
    const [plReport, setPlReport] = useState<any>(null)
    const [cashFlowReport, setCashFlowReport] = useState<any>(null)
    const [balanceSheetReport, setBalanceSheetReport] = useState<any>(null)
    const [comparison, setComparison] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [authToken, setAuthToken] = useState<string | null>(null)

    useEffect(() => {
        if (status === 'loading') return

        // Check if user is authenticated
        if (!session) {
            router.push('/admin')
            return
        }

        // Check if user has access to finance (FINANCE or ADMIN role)
        const allowedRoles = ['FINANCE', 'ADMIN']
        if (!session.user?.role || !allowedRoles.includes(session.user.role as any)) {
            router.push('/admin')
            return
        }

        // Load reports
        fetchReports()
    }, [session, status, month, year])

    const fetchReports = async () => {
        try {
            setLoading(true)

            // Generate temporary token for API access
            const tokenResponse = await fetch(`/api/finance/auth/generate-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: session?.user?.id,
                    email: session?.user?.email
                })
            })

            let token = null
            if (tokenResponse.ok) {
                const tokenData = await tokenResponse.json()
                token = tokenData.token
                setAuthToken(token) // Update state
                // Store token for future use
                if (token) {
                    localStorage.setItem('finance_token', token)
                }
            } else {
                const errorData = await tokenResponse.json()
                console.error('Token generation failed:', errorData)
                setAuthToken(null) // Update state
                // Continue without token - show error message to user
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            }

            // Add token if available
            if (token) {
                headers['x-finance-token'] = token
            }

            // Fetch P&L Report
            const plRes = await fetch(`/api/finance/reports/profit-loss?month=${month}&year=${year}`, {
                headers,
            })
            if (plRes.ok) {
                const data = await plRes.json()
                setPlReport(data)
            } else {
                console.error('P&L Report error:', plRes.status, plRes.statusText)
            }

            // Fetch Cash Flow Report
            const cfRes = await fetch(`/api/finance/reports/cash-flow?month=${month}&year=${year}`, {
                headers,
            })
            if (cfRes.ok) {
                const data = await cfRes.json()
                setCashFlowReport(data)
            } else {
                console.error('Cash Flow Report error:', cfRes.status, cfRes.statusText)
            }

            // Fetch Balance Sheet Report
            const bsRes = await fetch(`/api/finance/reports/balance-sheet?month=${month}&year=${year}`, {
                headers,
            })
            if (bsRes.ok) {
                const data = await bsRes.json()
                setBalanceSheetReport(data)
            } else {
                console.error('Balance Sheet Report error:', bsRes.status, bsRes.statusText)
            }

            // Fetch Comparison
            const compRes = await fetch(`/api/finance/reports/comparison?month=${month}&year=${year}`, {
                headers,
            })
            if (compRes.ok) {
                const data = await compRes.json()
                setComparison(data)
            } else {
                console.error('Comparison Report error:', compRes.status, compRes.statusText)
            }
        } catch (error) {
            console.error('Error fetching reports:', error)
        } finally {
            setLoading(false)
        }
    }

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]

    if (status === 'loading' || loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                        <HiOutlineArrowPath className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
                        <div className="text-gray-500 dark:text-gray-400">Memuat laporan keuangan...</div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Laporan Keuangan</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Laporan lengkap keuangan perusahaan</p>
                </div>
                <button
                    onClick={fetchReports}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <HiOutlineArrowPath className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Period Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Bulan
                        </label>
                        <select
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            {months.map((m, idx) => (
                                <option key={idx + 1} value={idx + 1}>
                                    {m}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Tahun
                        </label>
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            {[2024, 2025, 2026].map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Report Type Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex -mb-px">
                        <button
                            onClick={() => setActiveReport('pl')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeReport === 'pl'
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Profit & Loss
                        </button>
                        <button
                            onClick={() => setActiveReport('cashflow')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeReport === 'cashflow'
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Cash Flow Statement
                        </button>
                        <button
                            onClick={() => setActiveReport('balance-sheet')}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeReport === 'balance-sheet'
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            Balance Sheet
                        </button>
                    </nav>
                </div>

                <div className="p-6">
                    {activeReport === 'pl' && plReport && (
                        <div className="space-y-6">
                            {/* Revenue Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Pendapatan</h3>
                                <div className="space-y-2">
                                    {plReport.revenue?.breakdown?.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                {item.category} {item.type === 'subscription' ? '(Tagihan)' : '(Manual)'}
                                            </span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {formatRupiah(item.amount)}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between py-2 bg-green-50 dark:bg-green-900/20 px-3 rounded">
                                        <span className="text-sm font-bold text-green-700 dark:text-green-400">Total Pendapatan</span>
                                        <span className="text-sm font-bold text-green-700 dark:text-green-400">
                                            {formatRupiah(plReport.revenue?.total || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Expenses Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Biaya</h3>
                                <div className="space-y-2">
                                    {plReport.expenses?.breakdown?.map((item: any, idx: number) => (
                                        <div key={idx} className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                                {item.category} ({item.type})
                                            </span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {formatRupiah(item.amount)}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between py-2 bg-blue-50 dark:bg-blue-900/20 px-3 rounded">
                                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">OPEX</span>
                                        <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                            {formatRupiah(plReport.expenses?.opex || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 bg-orange-50 dark:bg-orange-900/20 px-3 rounded">
                                        <span className="text-sm font-medium text-orange-700 dark:text-orange-400">CAPEX</span>
                                        <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                                            {formatRupiah(plReport.expenses?.capex || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 bg-red-50 dark:bg-red-900/20 px-3 rounded">
                                        <span className="text-sm font-bold text-red-700 dark:text-red-400">Total Biaya</span>
                                        <span className="text-sm font-bold text-red-700 dark:text-red-400">
                                            {formatRupiah(plReport.expenses?.total || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Profit Section */}
                            <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between py-2">
                                        <span className="text-base font-medium text-gray-900 dark:text-white">Laba Kotor</span>
                                        <span className="text-base font-medium text-gray-900 dark:text-white">
                                            {formatRupiah(plReport.grossProfit || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-base font-medium text-gray-900 dark:text-white">Laba Operasional</span>
                                        <span className="text-base font-medium text-gray-900 dark:text-white">
                                            {formatRupiah(plReport.operatingProfit || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-4 rounded-lg">
                                        <span className="text-lg font-bold text-green-700 dark:text-green-400">Laba Bersih</span>
                                        <span className="text-lg font-bold text-green-700 dark:text-green-400">
                                            {formatRupiah(plReport.netProfit || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Profit Margin</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {plReport.profitMargin?.toFixed(2) || 0}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeReport === 'cashflow' && cashFlowReport && (
                        <div className="space-y-6">
                            {/* Operating Activities */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Aktivitas Operasional</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Kas dari Pelanggan</span>
                                        <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                            {formatRupiah(cashFlowReport.operatingActivities?.cashFromCustomers || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Kas ke Pemasok</span>
                                        <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                            ({formatRupiah(cashFlowReport.operatingActivities?.cashToSuppliers || 0)})
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 bg-blue-50 dark:bg-blue-900/20 px-3 rounded">
                                        <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Arus Kas Operasional</span>
                                        <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                                            {formatRupiah(cashFlowReport.operatingActivities?.netOperating || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Investing Activities */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Aktivitas Investasi</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Peralatan (CAPEX)</span>
                                        <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                            ({formatRupiah(cashFlowReport.investingActivities?.equipmentPurchases || 0)})
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 bg-orange-50 dark:bg-orange-900/20 px-3 rounded">
                                        <span className="text-sm font-bold text-orange-700 dark:text-orange-400">Arus Kas Investasi</span>
                                        <span className="text-sm font-bold text-orange-700 dark:text-orange-400">
                                            {formatRupiah(cashFlowReport.investingActivities?.netInvesting || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Summary */}
                            <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between py-2">
                                        <span className="text-base font-medium text-gray-900 dark:text-white">Saldo Awal</span>
                                        <span className="text-base font-medium text-gray-900 dark:text-white">
                                            {formatRupiah(cashFlowReport.openingCash || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2">
                                        <span className="text-base font-medium text-gray-900 dark:text-white">Arus Kas Bersih</span>
                                        <span className={`text-base font-medium ${Number(cashFlowReport.netCashFlow || 0) >= 0
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-red-600 dark:text-red-400'
                                            }`}>
                                            {formatRupiah(cashFlowReport.netCashFlow || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-4 rounded-lg">
                                        <span className="text-lg font-bold text-green-700 dark:text-green-400">Saldo Akhir</span>
                                        <span className="text-lg font-bold text-green-700 dark:text-green-400">
                                            {formatRupiah(cashFlowReport.closingCash || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeReport === 'balance-sheet' && balanceSheetReport && (
                        <div className="space-y-6">
                            {/* Assets Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Aset</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Aset Lancar</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {formatRupiah(balanceSheetReport.assets?.current || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Aset Tetap (CAPEX)</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {formatRupiah(balanceSheetReport.assets?.fixed || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 bg-blue-50 dark:bg-blue-900/20 px-3 rounded">
                                        <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Total Aset</span>
                                        <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                                            {formatRupiah(balanceSheetReport.assets?.total || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Liabilities Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Kewajiban</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Kewajiban Lancar</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {formatRupiah(balanceSheetReport.liabilities?.current || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Kewajiban Jangka Panjang</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {formatRupiah(balanceSheetReport.liabilities?.longTerm || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 bg-red-50 dark:bg-red-900/20 px-3 rounded">
                                        <span className="text-sm font-bold text-red-700 dark:text-red-400">Total Kewajiban</span>
                                        <span className="text-sm font-bold text-red-700 dark:text-red-400">
                                            {formatRupiah(balanceSheetReport.liabilities?.total || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Equity Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Ekuitas</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Ekuitas Awal</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {formatRupiah(balanceSheetReport.equity?.initial || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Laba Ditahan</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {formatRupiah(balanceSheetReport.equity?.retained || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-4 rounded-lg">
                                        <span className="text-lg font-bold text-green-700 dark:text-green-400">Total Ekuitas</span>
                                        <span className="text-lg font-bold text-green-700 dark:text-green-400">
                                            {formatRupiah(balanceSheetReport.equity?.total || 0)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!plReport && !cashFlowReport && !balanceSheetReport && (
                        <div className="text-center py-8">
                            <div className="text-gray-500 dark:text-gray-400">
                                {!authToken ? 'Tidak dapat mengakses laporan keuangan. Token autentikasi gagal di-generate.' : 'Belum ada data laporan untuk periode ini'}
                            </div>
                            {!authToken && (
                                <div className="mt-2">
                                    <button
                                        onClick={fetchReports}
                                        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        Coba Lagi
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}