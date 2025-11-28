"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    HiOutlineChartBar,
    HiOutlineCurrencyDollar,
    HiOutlineExclamationCircle,
    HiOutlineCheckCircle,
    HiArrowPath,
    HiOutlineBanknotes,
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

export default function BudgetDashboardPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [analysis, setAnalysis] = useState<any>(null)
    const [alerts, setAlerts] = useState<any[]>([])

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            setLoading(true)
            const currentDate = new Date()
            const month = currentDate.getMonth() + 1
            const year = currentDate.getFullYear()

            // Fetch budget analysis
            const analysisRes = await fetch(`/api/finance/budget/analysis?month=${month}&year=${year}`)
            if (analysisRes.ok) {
                const data = await analysisRes.json()
                setAnalysis(data)
            }

            // TODO: Fetch alerts when API is ready
            setAlerts([])
        } catch (error) {
            console.error('Error fetching budget data:', error)
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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'under':
                return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            case 'ok':
                return 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
            case 'warning':
                return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
            case 'exceeded':
                return 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            default:
                return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budget Management</h1>
                <p className="text-gray-500 dark:text-gray-400">Monitor and manage budgets</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Total Budget */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                            <HiOutlineBanknotes className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Total Budget
                    </h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {analysis ? formatRupiah(analysis.totalBudget) : formatRupiah(0)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {analysis?.month || '-'}/{analysis?.year || '-'}
                    </p>
                </div>

                {/* Actual Spending */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Actual Spending
                    </h3>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {analysis ? formatRupiah(analysis.totalActual) : formatRupiah(0)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {analysis ? `${analysis.overallUtilizationPercent.toFixed(1)}% utilized` : '0%'}
                    </p>
                </div>

                {/* Variance */}
                <div className={`rounded-xl shadow-md p-6 text-white ${analysis && parseInt(analysis.totalVariance) < 0
                        ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                        : 'bg-gradient-to-br from-red-400 to-rose-500'
                    }`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-white/20 rounded-lg">
                            <HiOutlineChartBar className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-white/80 mb-1">Variance</h3>
                    <p className="text-2xl font-bold">
                        {analysis ? formatRupiah(analysis.totalVariance) : formatRupiah(0)}
                    </p>
                    <p className="text-xs text-white/80 mt-1">
                        {analysis && parseInt(analysis.totalVariance) < 0 ? 'Under budget' : 'Over budget'}
                    </p>
                </div>
            </div>

            {/* Budget by Category */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Budget by Category
                    </h3>
                    <Link
                        href="/finance/budget/planning"
                        className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                        Manage Budgets
                    </Link>
                </div>

                <div className="space-y-4">
                    {!analysis || analysis.budgetsByCategory.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <HiOutlineChartBar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No budgets set for this period</p>
                            <Link
                                href="/finance/budget/planning"
                                className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                                Create Budget
                            </Link>
                        </div>
                    ) : (
                        analysis.budgetsByCategory.map((item: any) => {
                            const budgetNum = parseInt(item.budget.budgetAmount)
                            const actualNum = parseInt(item.budget.actualAmount)
                            const percentage = item.utilizationPercent

                            return (
                                <div key={item.budget.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-medium px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                                                {item.category.type}
                                            </span>
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {item.category.name}
                                            </span>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)}`}>
                                            {percentage.toFixed(1)}%
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mb-2">
                                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full transition-all ${percentage >= 100
                                                        ? 'bg-red-500'
                                                        : percentage >= 90
                                                            ? 'bg-yellow-500'
                                                            : 'bg-green-500'
                                                    }`}
                                                style={{ width: `${Math.min(percentage, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-sm">
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">Actual:</span>
                                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                                {formatRupiah(actualNum)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 dark:text-gray-400">Budget:</span>
                                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                                                {formatRupiah(budgetNum)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Link
                        href="/finance/budget/planning"
                        className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
                            <HiOutlineBanknotes className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">Budget Planning</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Create & manage budgets</p>
                        </div>
                    </Link>

                    <Link
                        href="/finance/budget/analysis"
                        className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                            <HiOutlineChartBar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">Budget Analysis</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Detailed analysis & reports</p>
                        </div>
                    </Link>

                    <Link
                        href="/finance/cashflow"
                        className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                            <HiOutlineCurrencyDollar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-white">Cashflow</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">View income & expenses</p>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    )
}
