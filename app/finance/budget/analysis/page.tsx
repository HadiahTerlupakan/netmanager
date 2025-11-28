"use client"

import { useEffect, useState } from 'react'
import { HiArrowPath, HiChartBar, HiExclamationTriangle } from 'react-icons/hi2'

interface BudgetAnalysis {
    categoryCode: string
    categoryName: string
    budgetAmount: string
    actualAmount: string
    variance: string
    utilizationPercentage: number
    status: string
}

const formatRupiah = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

export default function BudgetAnalysisPage() {
    const [loading, setLoading] = useState(true)
    const [analysis, setAnalysis] = useState<BudgetAnalysis[]>([])
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

    useEffect(() => {
        fetchAnalysis()
    }, [selectedYear, selectedMonth])

    const fetchAnalysis = async () => {
        try {
            setLoading(true)
            const response = await fetch(
                `/api/finance/budget/analysis?year=${selectedYear}&month=${selectedMonth}`
            )
            if (response.ok) {
                const data = await response.json()
                setAnalysis(data.byCategory || [])
            }
        } catch (error) {
            console.error('Error fetching budget analysis:', error)
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'UNDER_BUDGET':
                return 'text-green-600 bg-green-50'
            case 'ON_TRACK':
                return 'text-blue-600 bg-blue-50'
            case 'NEAR_LIMIT':
                return 'text-yellow-600 bg-yellow-50'
            case 'OVER_BUDGET':
                return 'text-red-600 bg-red-50'
            default:
                return 'text-gray-600 bg-gray-50'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'UNDER_BUDGET':
                return 'Under Budget'
            case 'ON_TRACK':
                return 'On Track'
            case 'NEAR_LIMIT':
                return 'Near Limit'
            case 'OVER_BUDGET':
                return 'Over Budget'
            default:
                return status
        }
    }

    const totalBudget = analysis.reduce((sum, item) => sum + parseFloat(item.budgetAmount), 0)
    const totalActual = analysis.reduce((sum, item) => sum + parseFloat(item.actualAmount), 0)
    const totalVariance = totalBudget - totalActual
    const overallUtilization = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0

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
                        <h1 className="text-2xl font-bold text-gray-900">Budget Analysis</h1>
                        <p className="text-sm text-gray-600">
                            Analisis variance budget vs actual spending
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

                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="px-4 py-2 border border-gray-300 rounded-lg"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                <option key={month} value={month}>
                                    {new Date(2000, month - 1).toLocaleString('id-ID', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <p className="text-sm text-gray-600">Total Budget</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                        {formatRupiah(totalBudget)}
                    </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <p className="text-sm text-gray-600">Total Actual</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                        {formatRupiah(totalActual)}
                    </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <p className="text-sm text-gray-600">Variance</p>
                    <p className={`text-2xl font-bold mt-1 ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatRupiah(Math.abs(totalVariance))}
                        {totalVariance >= 0 ? ' ↓' : ' ↑'}
                    </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <p className="text-sm text-gray-600">Utilization</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                        {overallUtilization.toFixed(1)}%
                    </p>
                </div>
            </div>

            {/* Analysis Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Budget by Category</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Category
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Budget
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Actual
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Variance
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Utilization
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {analysis.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <HiChartBar className="h-12 w-12 text-gray-400" />
                                            <p>No budget data available for this period</p>
                                            <p className="text-sm">Create budgets to see analysis</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                analysis.map((item) => {
                                    const variance = parseFloat(item.budgetAmount) - parseFloat(item.actualAmount)
                                    const isOverBudget = variance < 0

                                    return (
                                        <tr key={item.categoryCode} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                {item.categoryName}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right text-gray-900">
                                                {formatRupiah(item.budgetAmount)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right text-blue-600 font-medium">
                                                {formatRupiah(item.actualAmount)}
                                            </td>
                                            <td className={`px-6 py-4 text-sm text-right font-medium ${isOverBudget ? 'text-red-600' : 'text-green-600'
                                                }`}>
                                                {formatRupiah(Math.abs(variance))}
                                                {isOverBudget && (
                                                    <span className="ml-1">
                                                        <HiExclamationTriangle className="inline h-4 w-4" />
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                                        <div
                                                            className={`h-2 rounded-full ${item.utilizationPercentage > 100
                                                                    ? 'bg-red-600'
                                                                    : item.utilizationPercentage > 80
                                                                        ? 'bg-yellow-600'
                                                                        : 'bg-green-600'
                                                                }`}
                                                            style={{ width: `${Math.min(item.utilizationPercentage, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-600">
                                                        {item.utilizationPercentage.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(item.status)}`}>
                                                    {getStatusLabel(item.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                    Budget Analysis Guide
                </h4>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li><strong>Variance:</strong> Selisih antara budget dan actual (positif = under budget)</li>
                    <li><strong>Utilization:</strong> Persentase penggunaan budget</li>
                    <li><strong>Status:</strong> Under Budget (\u003c80%), On Track (80-90%), Near Limit (90-100%), Over Budget (\u003e100%)</li>
                </ul>
            </div>
        </div>
    )
}
