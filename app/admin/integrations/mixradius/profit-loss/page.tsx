'use client'

import { useState, useEffect } from 'react'
import {
    HiOutlineCurrencyDollar,
    HiOutlineArrowTrendingUp,
    HiOutlineArrowTrendingDown,
    HiOutlineCalendar,
    HiOutlineChartBar
} from 'react-icons/hi2'
import { formatCurrency } from '@/lib/utils'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
)

interface ProfitLossData {
    summary: {
        totalIncome: number
        totalExpense: number
        netProfit: number
    }
    trend: {
        date: string
        income: number
        expense: number
    }[]
    topExpenses: {
        name: string
        amount: number
    }[]
    monthlyBreakdown: {
        month: string
        income: number
        expense: number
        net: number
    }[]
}

export default function ProfitLossPage() {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<ProfitLossData | null>(null)

    // Default: Current Month
    const [startDate, setStartDate] = useState(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0]
    })

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate])

    const fetchData = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ startDate, endDate })
            const res = await fetch(`/api/integrations/mixradius/profit-loss?${params}`)
            const json = await res.json()
            if (!json.error) {
                setData(json)
            }
        } catch (error) {
            console.error('Failed to fetch P&L', error)
        } finally {
            setLoading(false)
        }
    }

    // Chart Data Configuration
    const chartData = {
        labels: data?.trend?.map((d) => new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })) || [],
        datasets: [
            {
                label: 'Pendapatan',
                data: data?.trend?.map((d) => d.income) || [],
                borderColor: '#10b981', // Emerald 500
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Pengeluaran',
                data: data?.trend?.map((d) => d.expense) || [],
                borderColor: '#ef4444', // Red 500
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
            }
        ]
    }

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' as const },
        },
        maintainAspectRatio: false
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineChartBar className="w-8 h-8 text-blue-600" />
                        Laporan Laba Rugi
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Analisa Pendapatan vs Pengeluaran (MixRadius)
                    </p>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 shadow-sm">
                    <HiOutlineCalendar className="w-5 h-5 text-gray-500" />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
                    />
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Income */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <HiOutlineArrowTrendingUp className="w-20 h-20 text-emerald-500" />
                    </div>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Total Pendapatan</p>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white">
                        {loading ? '...' : formatCurrency(data?.summary?.totalIncome || 0)}
                    </h3>
                    <p className="text-xs text-gray-500 mt-2">Dari Invoice Lunas</p>
                </div>

                {/* Expense */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-red-100 dark:border-red-900/30 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <HiOutlineArrowTrendingDown className="w-20 h-20 text-red-500" />
                    </div>
                    <p className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Total Pengeluaran</p>
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white">
                        {loading ? '...' : formatCurrency(data?.summary?.totalExpense || 0)}
                    </h3>
                    <p className="text-xs text-gray-500 mt-2">OPEX & CAPEX</p>
                </div>

                {/* Net Profit */}
                <div className={`bg-white dark:bg-gray-800 p-6 rounded-2xl border shadow-sm relative overflow-hidden ${
                    (data?.summary?.netProfit || 0) >= 0
                        ? 'border-blue-100 dark:border-blue-900/30'
                        : 'border-orange-100 dark:border-orange-900/30'
                }`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <HiOutlineCurrencyDollar className={`w-20 h-20 ${(data?.summary?.netProfit || 0) >= 0 ? 'text-blue-500' : 'text-orange-500'}`} />
                    </div>
                    <p className={`text-sm font-bold uppercase tracking-wider mb-1 ${(data?.summary?.netProfit || 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        Laba / Rugi Bersih
                    </p>
                    <h3 className={`text-3xl font-black ${(data?.summary?.netProfit || 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                        {loading ? '...' : formatCurrency(data?.summary?.netProfit || 0)}
                    </h3>
                    <p className="text-xs text-gray-500 mt-2">
                        {(data?.summary?.netProfit || 0) >= 0 ? 'Keuntungan (Profit)' : 'Kerugian (Loss)'}
                    </p>
                </div>
            </div>

            {/* Charts & Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Trend Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Tren Arus Kas</h3>
                    <div className="h-80">
                        <Line options={chartOptions} data={chartData} />
                    </div>
                </div>

                {/* Top Expenses */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top 5 Pengeluaran</h3>
                    <div className="space-y-4">
                        {data?.topExpenses?.length > 0 ? (
                            data.topExpenses.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 flex items-center justify-center bg-red-100 dark:bg-red-900/50 text-red-600 text-xs font-bold rounded-full">
                                            {idx + 1}
                                        </span>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {item.name === 'OPEX' || item.name === 'CAPEX' ? item.name : item.name}
                                        </span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(item.amount)}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-8">Belum ada data pengeluaran</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Monthly Breakdown Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Rincian Bulanan</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase font-bold text-gray-500">
                            <tr>
                                <th className="px-6 py-4">Bulan</th>
                                <th className="px-6 py-4 text-right text-emerald-600">Pendapatan</th>
                                <th className="px-6 py-4 text-right text-red-600">Pengeluaran</th>
                                <th className="px-6 py-4 text-right text-blue-600">Laba Bersih</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {data?.monthlyBreakdown?.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                        {new Date(item.month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-gray-600 dark:text-gray-300">
                                        {formatCurrency(item.income)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-gray-600 dark:text-gray-300">
                                        {formatCurrency(item.expense)}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-mono font-bold ${item.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                        {formatCurrency(item.net)}
                                    </td>
                                </tr>
                            ))}
                            {(!data?.monthlyBreakdown || data.monthlyBreakdown.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                        Tidak ada data untuk periode ini
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}