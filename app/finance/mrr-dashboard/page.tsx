"use client"

import { useEffect, useState } from 'react'
import { useFinance } from '@/hooks/useFinance'
import {
    HiOutlineArrowPath,
    HiBars3,
    HiOutlineChartBar,
    HiOutlineArrowTrendingUp,
    HiOutlineArrowTrendingDown,
    HiOutlineUsers,
    HiOutlineCurrencyDollar,
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

const formatRupiah = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? Number(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numAmount)
}

const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
    })
}

export default function MRRDashboardPage() {
    const { data: financeUser, loading: userLoading } = useFinance()
    const [metrics, setMetrics] = useState<any>(null)
    const [trend, setTrend] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('finance_token')
            if (!token) return

            setLoading(true)

            // Fetch current metrics
            const metricsRes = await fetch('/api/finance/revenue/metrics', {
                headers: { 'x-finance-token': token },
            })
            if (metricsRes.ok) {
                const data = await metricsRes.json()
                setMetrics(data)
            }

            // Fetch trend data
            const trendRes = await fetch('/api/finance/revenue/trend?limit=12', {
                headers: { 'x-finance-token': token },
            })
            if (trendRes.ok) {
                const data = await trendRes.json()
                setTrend(data.data.reverse()) // Oldest to newest for chart
            }
        } catch (error) {
            console.error('Error fetching MRR data:', error)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        if (financeUser) {
            fetchData()
        }
    }, [financeUser])

    const handleRefresh = () => {
        setRefreshing(true)
        fetchData()
    }

    const handleCreateSnapshot = async () => {
        try {
            const token = localStorage.getItem('finance_token')
            const res = await fetch('/api/finance/revenue/snapshot', {
                method: 'POST',
                headers: { 'x-finance-token': token || '' },
            })

            if (res.ok) {
                alert('✓ Revenue snapshot created successfully!')
                fetchData() // Refresh data
            }
        } catch (error) {
            console.error('Error creating snapshot:', error)
        }
    }

    if (userLoading || loading) {
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
                                        ; (window as any).toggleFinanceSidebar()
                                    }
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
                            >
                                <HiBars3 className="w-6 h-6" />
                            </button>
                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                                <HiOutlineChartBar className="w-6 h-6" />
                            </div>
                            <h1 className="text-xl font-bold">MRR/ARR Dashboard</h1>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleCreateSnapshot}
                                className="px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
                            >
                                Create Snapshot
                            </button>
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <HiOutlineArrowPath className={`w-6 h-6 ${refreshing ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-4 py-4 md:px-6 lg:px-8">
                {/* Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {/* Total MRR */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Monthly Recurring Revenue
                                </p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                    {metrics ? formatRupiah(metrics.totalMRR) : formatRupiah(0)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Current MRR</p>
                            </div>
                            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                                <HiOutlineCurrencyDollar className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                    </div>

                    {/* Total ARR */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Annual Recurring Revenue
                                </p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {metrics ? formatRupiah(metrics.totalARR) : formatRupiah(0)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">MRR × 12</p>
                            </div>
                            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <HiOutlineArrowTrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                    </div>

                    {/* Active Customers */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Active Customers
                                </p>
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    {metrics ? metrics.activeCustomers.toLocaleString('id-ID') : 0}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Status: AKTIF</p>
                            </div>
                            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                <HiOutlineUsers className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                        </div>
                    </div>

                    {/* ARPU */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                    Average Revenue Per User
                                </p>
                                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                    {metrics ? formatRupiah(metrics.arpu) : formatRupiah(0)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Per customer/month</p>
                            </div>
                            <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                <HiOutlineArrowTrendingDown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* MRR Movement */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        MRR Movement
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">New MRR</p>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                {metrics ? formatRupiah(metrics.movements.newMRR) : formatRupiah(0)}
                            </p>
                        </div>
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Expansion</p>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {metrics ? formatRupiah(metrics.movements.expansionMRR) : formatRupiah(0)}
                            </p>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Contraction</p>
                            <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                {metrics ? formatRupiah(metrics.movements.contractionMRR) : formatRupiah(0)}
                            </p>
                        </div>
                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Churn</p>
                            <p className="text-lg font-bold text-red-600 dark:text-red-400">
                                {metrics ? formatRupiah(metrics.movements.churnMRR) : formatRupiah(0)}
                            </p>
                        </div>
                        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Reactivation</p>
                            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                {metrics ? formatRupiah(metrics.movements.reactivationMRR) : formatRupiah(0)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Revenue Trend Chart (Simple Bar Chart) */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        MRR Trend (Last 12 Months)
                    </h3>
                    <div className="flex items-end justify-between gap-2 h-64">
                        {trend.map((snapshot, idx) => {
                            const mrr = Number(snapshot.totalMRR)
                            const maxMRR = Math.max(...trend.map((s: any) => Number(s.totalMRR)))
                            const height = maxMRR > 0 ? (mrr / maxMRR) * 100 : 0

                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center justify-end">
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1 text-center">
                                        {formatRupiah(mrr / 1000000)}M
                                    </div>
                                    <div
                                        className="w-full bg-emerald-500 dark:bg-emerald-400 rounded-t transition-all hover:bg-emerald-600"
                                        style={{ height: `${height}%`, minHeight: '8px' }}
                                        title={`${formatDate(snapshot.snapshotDate)}: ${formatRupiah(mrr)}`}
                                    />
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                                        {formatDate(snapshot.snapshotDate)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Revenue Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* By Package */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Revenue by Package
                        </h3>
                        <div className="space-y-3">
                            {metrics?.breakdown.byPackage.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {item.paketName}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {item.count} customers
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatRupiah(item.mrr)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* By Area */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Revenue by Area
                        </h3>
                        <div className="space-y-3">
                            {metrics?.breakdown.byArea.slice(0, 10).map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {item.area}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {item.count} customers
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                        {formatRupiah(item.mrr)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
