'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { 
    HiOutlineChartBar, 
    HiOutlineTrophy, 
    HiOutlineUsers, 
    HiOutlineArrowTrendingUp,
    HiOutlineStar,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineXCircle,
    HiOutlineBuildingOffice
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { toast } from 'react-hot-toast'

interface SalesUser {
    id: string
    name: string
    target: number
    approved: number
    pending: number
    rejected: number
    total: number
    points: number
    progress: number
    rank: number
}

interface Site {
    id: string
    code: string
    name: string
}

interface TopSite {
    id: string
    code: string
    name: string
    approved: number
    salesCount: number
}

interface DashboardData {
    period: string
    siteId: string | null
    sites: Site[]
    teamStats: {
        totalSales: number
        totalCanvasing: number
        totalApproved: number
        totalPending: number
        totalRejected: number
        totalPoints: number
        avgProgress: number
    }
    topPerformers: SalesUser[]
    topSites: TopSite[]
    leaderboard: SalesUser[]
    weeklyTrend: { date: string; day: string; count: number }[]
}

const periodLabels: Record<string, string> = {
    day: 'Hari Ini',
    week: 'Minggu Ini',
    month: 'Bulan Ini',
    all: 'Semua Waktu',
    custom: 'Custom'
}

export default function SalesDashboardClient() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<DashboardData | null>(null)
    const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all' | 'custom'>('month')
    const [siteId, setSiteId] = useState<string>('')
    const [startDate, setStartDate] = useState<string>('')
    const [endDate, setEndDate] = useState<string>('')

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({ period })
            if (siteId) params.append('siteId', siteId)
            if (period === 'custom' && startDate && endDate) {
                params.append('startDate', startDate)
                params.append('endDate', endDate)
            }

            const res = await fetch(`/api/admin/marketing/sales-dashboard?${params.toString()}`)
            if (res.ok) {
                const json = await res.json()
                setData(json.data)
            } else {
                const json = await res.json().catch((): null => null)
                toast.error(json?.error || 'Gagal memuat data dashboard')
            }
        } catch (error) {
            console.error('Error:', error)
            toast.error('Gagal menghubungi server, coba lagi nanti')
        } finally {
            setLoading(false)
        }
    }, [period, siteId, startDate, endDate])

    useEffect(() => {
        // Only auto-fetch for non-custom periods or when custom has both dates
        if (period !== 'custom' || (startDate && endDate)) {
            fetchData()
        }
    }, [fetchData, period, startDate, endDate])

    if (loading && !data) return <PageLoader message="Memuat dashboard sales..." />

    if (!data) return (
        <div className="p-8 text-center text-gray-500">
            Data tidak ditemukan
        </div>
    )

    const maxTrend = Math.max(...data.weeklyTrend.map(t => t.count), 1)

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineChartBar className="w-7 h-7 text-indigo-500" />
                        Dashboard Sales
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Overview performa tim sales dan canvasing
                    </p>
                </div>
                
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Site Filter */}
                    {data.sites && data.sites.length > 0 && (
                        <div className="flex items-center gap-2">
                            <HiOutlineBuildingOffice className="w-4 h-4 text-gray-500" />
                            <select
                                value={siteId}
                                onChange={(e) => setSiteId(e.target.value)}
                                disabled={loading}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="">Semua Site</option>
                                {data.sites.map((site) => (
                                    <option key={site.id} value={site.id}>
                                        {site.code} - {site.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    {/* Period Filter */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        {(['day', 'week', 'month', 'all', 'custom'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                disabled={loading}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    period === p
                                        ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                            >
                                {periodLabels[p]}
                            </button>
                        ))}
                    </div>
                    
                    {/* Custom Date Range */}
                    {period === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <span className="text-gray-500 text-xs">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Team Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <StatCard 
                    label="Total Sales" 
                    value={data.teamStats.totalSales} 
                    icon={HiOutlineUsers} 
                    color="indigo" 
                />
                <StatCard 
                    label="Total Canvasing" 
                    value={data.teamStats.totalCanvasing} 
                    icon={HiOutlineChartBar} 
                    color="blue" 
                />
                <StatCard 
                    label="Disetujui" 
                    value={data.teamStats.totalApproved} 
                    icon={HiOutlineCheckCircle} 
                    color="emerald" 
                />
                <StatCard 
                    label="Pending" 
                    value={data.teamStats.totalPending} 
                    icon={HiOutlineClock} 
                    color="amber" 
                />
                <StatCard 
                    label="Ditolak" 
                    value={data.teamStats.totalRejected} 
                    icon={HiOutlineXCircle} 
                    color="rose" 
                />
                <StatCard 
                    label="Total Poin" 
                    value={data.teamStats.totalPoints} 
                    icon={HiOutlineStar} 
                    color="yellow" 
                />
                <StatCard 
                    label="Avg Progress" 
                    value={`${data.teamStats.avgProgress}%`} 
                    icon={HiOutlineArrowTrendingUp} 
                    color="purple" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Performers */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <HiOutlineTrophy className="w-5 h-5 text-amber-500" />
                        Top Performers
                    </h3>
                    
                    <div className="space-y-4">
                        {data.topPerformers.length === 0 ? (
                            <p className="text-center text-gray-500 py-4">Belum ada data</p>
                        ) : (
                            data.topPerformers.map((user, index) => (
                                <Link 
                                    href={`/admin/marketing/sales/${user.id}`} 
                                    key={user.id}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                                        index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                        index === 1 ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' :
                                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                    }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                                        <p className="text-xs text-gray-500">{user.approved} canvasing • {user.points} poin</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{user.progress}%</p>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* Top Sites */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <HiOutlineBuildingOffice className="w-5 h-5 text-blue-500" />
                        Top Sites
                    </h3>
                    
                    <div className="space-y-4">
                        {(!data.topSites || data.topSites.length === 0) ? (
                            <p className="text-center text-gray-500 py-4">Belum ada data</p>
                        ) : (
                            data.topSites.map((site, index) => (
                                <div 
                                    key={site.id || site.code}
                                    onClick={() => setSiteId(site.id)}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                                        index === 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                        index === 1 ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' :
                                        'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
                                    }`}>
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">{site.code}</p>
                                        <p className="text-xs text-gray-500">{site.name} • {site.salesCount} sales</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{site.approved}</p>
                                        <p className="text-xs text-gray-400">disetujui</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Weekly Trend Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                    <HiOutlineArrowTrendingUp className="w-5 h-5 text-emerald-500" />
                    Trend Canvasing Disetujui (7 Hari Terakhir)
                </h3>
                
                <div className="flex items-end gap-2 h-40">
                    {data.weeklyTrend.map((trend) => (
                        <div key={trend.date} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">{trend.count}</span>
                            <div 
                                className="w-full bg-indigo-500 rounded-t-md transition-all"
                                style={{ height: `${(trend.count / maxTrend) * 100}%`, minHeight: trend.count > 0 ? '8px' : '4px' }}
                            />
                            <span className="text-xs text-gray-500">{trend.day}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Full Leaderboard */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineUsers className="w-5 h-5 text-gray-500" />
                        Ranking Sales - {periodLabels[period]}
                    </h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Rank</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Target</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Disetujui</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Pending</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ditolak</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Poin</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Progress</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {data.leaderboard.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                                            user.rank === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                            user.rank === 2 ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' :
                                            user.rank === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                        }`}>
                                            {user.rank}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link href={`/admin/marketing/sales/${user.id}`} className="font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400">
                                            {user.name}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{user.target}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                            {user.approved}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                            {user.pending}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
                                            {user.rejected}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                            ⭐ {user.points}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${user.progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${Math.min(user.progress, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10 text-right">
                                                {user.progress}%
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {data.leaderboard.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        Belum ada sales terdaftar
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

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
    const colorClasses: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
        yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${colorClasses[color]}`}>
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
    )
}
