"use client"

import { useState, useEffect } from 'react'
import { useFinance } from '@/hooks/useFinance'
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

export default function FinancialReportsPage() {
    const { data: financeUser, loading: userLoading } = useFinance()
    const [activeReport, setActiveReport] = useState<'pl' | 'cashflow'>('pl')
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [year, setYear] = useState(new Date().getFullYear())
    const [plReport, setPlReport] = useState<any>(null)
    const [cashFlowReport, setCashFlowReport] = useState<any>(null)
    const [comparison, setComparison] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const fetchReports = async () => {
        try {
            const token = localStorage.getItem('finance_token')
            if (!token) return

            setLoading(true)

            // Fetch P&L Report
            const plRes = await fetch(`/api/finance/reports/profit-loss?month=${month}&year=${year}`, {
                headers: { 'x-finance-token': token },
            })
            if (plRes.ok) {
                const data = await plRes.json()
                setPlReport(data)
            }

            // Fetch Cash Flow Report
            const cfRes = await fetch(`/api/finance/reports/cash-flow?month=${month}&year=${year}`, {
                headers: { 'x-finance-token': token },
            })
            if (cfRes.ok) {
                const data = await cfRes.json()
                setCashFlowReport(data)
            }

            // Fetch Comparison
            const compRes = await fetch(`/api/finance/reports/comparison?month=${month}&year=${year}`, {
                headers: { 'x-finance-token': token },
            })
            if (compRes.ok) {
                const data = await compRes.json()
                setComparison(data)
            }
        } catch (error) {
            console.error('Error fetching reports:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (financeUser) {
            fetchReports()
        }
    }, [financeUser, month, year])

    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]

    if (userLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center">
                    <HiOutlineArrowPath className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto mb-4" />
                    <div className="text-gray-500 dark:text-gray-400">Memuat laporan...</div>
                </div>
            </div>
        )
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
                                        ; (window as any).toggleFinanceSidebar()
                                    }
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
                            >
                                <HiBars3 className="w-6 h-6" />
                            </button>
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <HiOutlineDocumentChartBar className="w-6 h-6" />
                            </div>
                            <h1 className="text-xl font-bold">Financial Reports</h1>
                        </div>
                        <button
                            onClick={fetchReports}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <HiOutlineArrowPath className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-4 py-4 md:px-6 lg:px-8">
                {/* Period Selector */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6">
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
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md mb-6">
                    <div className="border-b border-gray-200 dark:border-gray-700">
                        <nav className="flex -mb-px">
                            <button
                                onClick={() => setActiveReport('pl')}
                                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeReport === 'pl'
                                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                Profit & Loss
                            </button>
                            <button
                                onClick={() => setActiveReport('cashflow')}
                                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeReport === 'cashflow'
                                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                Cash Flow Statement
                            </button>
                        </nav>
                    </div>

                    <div className="p-6">
                        {activeReport === 'pl' && plReport && (
                            <div className="space-y-6">
                                {/* Revenue Section */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Revenue</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Subscription Revenue</span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {formatRupiah(plReport.revenue.breakdown.subscriptions)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Other Income</span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {formatRupiah(plReport.revenue.breakdown.manualIncome)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 rounded">
                                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Total Revenue</span>
                                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                                {formatRupiah(plReport.revenue.total)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Expenses Section */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Expenses</h3>
                                    <div className="space-y-2">
                                        {plReport.expenses.breakdown.map((item: any, idx: number) => (
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
                                                {formatRupiah(plReport.expenses.opex)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2 bg-orange-50 dark:bg-orange-900/20 px-3 rounded">
                                            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">CAPEX</span>
                                            <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                                                {formatRupiah(plReport.expenses.capex)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2 bg-red-50 dark:bg-red-900/20 px-3 rounded">
                                            <span className="text-sm font-bold text-red-700 dark:text-red-400">Total Expenses</span>
                                            <span className="text-sm font-bold text-red-700 dark:text-red-400">
                                                {formatRupiah(plReport.expenses.total)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Profit Section */}
                                <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between py-2">
                                            <span className="text-base font-medium text-gray-900 dark:text-white">Gross Profit</span>
                                            <span className="text-base font-medium text-gray-900 dark:text-white">
                                                {formatRupiah(plReport.grossProfit)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 px-4 rounded-lg">
                                            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Net Profit</span>
                                            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                                                {formatRupiah(plReport.netProfit)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Profit Margin</span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {plReport.profitMargin.toFixed(2)}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Month Comparison */}
                                {comparison && (
                                    <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">vs Previous Month</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Revenue Change</div>
                                                <div className={`text-2xl font-bold flex items-center gap-2 ${comparison.changes.revenue.percentage >= 0
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-red-600 dark:text-red-400'
                                                    }`}>
                                                    {comparison.changes.revenue.percentage >= 0 ? (
                                                        <HiOutlineArrowTrendingUp className="w-6 h-6" />
                                                    ) : (
                                                        <HiOutlineArrowTrendingDown className="w-6 h-6" />
                                                    )}
                                                    {comparison.changes.revenue.percentage.toFixed(1)}%
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    {formatRupiah(comparison.changes.revenue.amount)}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Profit Change</div>
                                                <div className={`text-2xl font-bold flex items-center gap-2 ${comparison.changes.profit.percentage >= 0
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-red-600 dark:text-red-400'
                                                    }`}>
                                                    {comparison.changes.profit.percentage >= 0 ? (
                                                        <HiOutlineArrowTrendingUp className="w-6 h-6" />
                                                    ) : (
                                                        <HiOutlineArrowTrendingDown className="w-6 h-6" />
                                                    )}
                                                    {comparison.changes.profit.percentage.toFixed(1)}%
                                                </div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    {formatRupiah(comparison.changes.profit.amount)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeReport === 'cashflow' && cashFlowReport && (
                            <div className="space-y-6">
                                {/* Operating Activities */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Operating Activities</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Cash from Customers</span>
                                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                                {formatRupiah(cashFlowReport.operatingActivities.cashFromCustomers)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Cash to Suppliers</span>
                                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                                ({formatRupiah(cashFlowReport.operatingActivities.cashToSuppliers)})
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2 bg-blue-50 dark:bg-blue-900/20 px-3 rounded">
                                            <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Net Operating Cash Flow</span>
                                            <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                                                {formatRupiah(cashFlowReport.operatingActivities.netOperating)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Investing Activities */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Investing Activities</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Equipment Purchases (CAPEX)</span>
                                            <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                                ({formatRupiah(cashFlowReport.investingActivities.equipmentPurchases)})
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2 bg-orange-50 dark:bg-orange-900/20 px-3 rounded">
                                            <span className="text-sm font-bold text-orange-700 dark:text-orange-400">Net Investing Cash Flow</span>
                                            <span className="text-sm font-bold text-orange-700 dark:text-orange-400">
                                                {formatRupiah(cashFlowReport.investingActivities.netInvesting)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Financing Activities */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Financing Activities</h3>
                                    <div className="space-y-2">
                                        <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Loans Received</span>
                                            <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                                {formatRupiah(cashFlowReport.financingActivities.loansReceived)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2 bg-purple-50 dark:bg-purple-900/20 px-3 rounded">
                                            <span className="text-sm font-bold text-purple-700 dark:text-purple-400">Net Financing Cash Flow</span>
                                            <span className="text-sm font-bold text-purple-700 dark:text-purple-400">
                                                {formatRupiah(cashFlowReport.financingActivities.netFinancing)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between py-2">
                                            <span className="text-base font-medium text-gray-900 dark:text-white">Opening Cash</span>
                                            <span className="text-base font-medium text-gray-900 dark:text-white">
                                                {formatRupiah(cashFlowReport.openingCash)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2">
                                            <span className="text-base font-medium text-gray-900 dark:text-white">Net Cash Flow</span>
                                            <span className={`text-base font-medium ${Number(cashFlowReport.netCashFlow) >= 0
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                {formatRupiah(cashFlowReport.netCashFlow)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 px-4 rounded-lg">
                                            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Closing Cash</span>
                                            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                                                {formatRupiah(cashFlowReport.closingCash)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}
