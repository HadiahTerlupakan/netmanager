'use client'

import { Bar, Line, Doughnut } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js'
import { HiCalendarDays, HiMagnifyingGlass, HiArrowTrendingUp } from 'react-icons/hi2'

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
)

// Types
type VolumeTrendItem = { month: string; created: number; completed: number; requested: number }
type IssueTrendItem = { month: string; issues: Array<{ issue: string; count: number }> }
type PerformanceTrendItem = { month: string; avgCompletionHours: number; avgRating: number | null; totalCompleted: number }
type TypeTrendItem = { month: string; types: Array<{ type: string; count: number }> }

interface Props {
    volumeTrend: VolumeTrendItem[]
    issueTrend: IssueTrendItem[]
    performanceTrend: PerformanceTrendItem[]
    typeTrend: TypeTrendItem[]
    loading: boolean
    startDate: string
    endDate: string
    onDateChange: (start: string, end: string) => void
    onApply: () => void
}

// Color palette for charts
const CHART_COLORS = {
    blue: 'rgb(59, 130, 246)',
    green: 'rgb(34, 197, 94)',
    purple: 'rgb(168, 85, 247)',
    pink: 'rgb(236, 72, 153)',
    orange: 'rgb(249, 115, 22)',
    red: 'rgb(239, 68, 68)',
    teal: 'rgb(20, 184, 166)',
    indigo: 'rgb(99, 102, 241)',
}

const CHART_COLORS_ALPHA = {
    blue: 'rgba(59, 130, 246, 0.5)',
    green: 'rgba(34, 197, 94, 0.5)',
    purple: 'rgba(168, 85, 247, 0.5)',
    pink: 'rgba(236, 72, 153, 0.5)',
    orange: 'rgba(249, 115, 22, 0.5)',
    red: 'rgba(239, 68, 68, 0.5)',
    teal: 'rgba(20, 184, 166, 0.5)',
    indigo: 'rgba(99, 102, 241, 0.5)',
}

// Loading skeleton component - moved outside to avoid creating components during render
const ChartSkeleton = () => (
    <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse flex items-center justify-center">
        <span className="text-gray-400">Loading...</span>
    </div>
)

export function WoTrendCharts({
    volumeTrend,
    issueTrend,
    performanceTrend,
    typeTrend,
    loading,
    startDate,
    endDate,
    onDateChange,
    onApply
}: Props) {

    // === VOLUME CHART CONFIG ===
    const volumeChartData = {
        labels: volumeTrend.map(d => d.month),
        datasets: [
            {
                label: 'Request',
                data: volumeTrend.map(d => d.requested || 0),
                backgroundColor: CHART_COLORS_ALPHA.orange,
                borderColor: CHART_COLORS.orange,
                borderWidth: 2,
                borderRadius: 4,
            },
            {
                label: 'Dibuat',
                data: volumeTrend.map(d => d.created),
                backgroundColor: CHART_COLORS_ALPHA.blue,
                borderColor: CHART_COLORS.blue,
                borderWidth: 2,
                borderRadius: 4,
            },
            {
                label: 'Selesai',
                data: volumeTrend.map(d => d.completed),
                backgroundColor: CHART_COLORS_ALPHA.green,
                borderColor: CHART_COLORS.green,
                borderWidth: 2,
                borderRadius: 4,
            }
        ]
    }

    const volumeChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { usePointStyle: true, padding: 15 }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                callbacks: {
                    label: (context: { dataset: { label?: string }; parsed: { y: number } }) => `${context.dataset.label || ''}: ${context.parsed.y} WO`
                }
            }
        },
        scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } }
        }
    }

    // === PERFORMANCE CHART CONFIG (Line Chart) ===
    const performanceChartData = {
        labels: performanceTrend.map(d => d.month),
        datasets: [
            {
                label: 'Avg Waktu (jam)',
                data: performanceTrend.map(d => d.avgCompletionHours),
                borderColor: CHART_COLORS.purple,
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: CHART_COLORS.purple,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                yAxisID: 'y',
            },
            {
                label: 'Total WO',
                data: performanceTrend.map(d => d.totalCompleted),
                borderColor: CHART_COLORS.teal,
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.4,
                pointBackgroundColor: CHART_COLORS.teal,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 3,
                yAxisID: 'y1',
            }
        ]
    }

    const performanceChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { usePointStyle: true, padding: 15 }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
            }
        },
        scales: {
            x: { grid: { display: false } },
            y: {
                type: 'linear' as const,
                display: true,
                position: 'left' as const,
                beginAtZero: true,
                title: { display: true, text: 'Jam' },
                grid: { color: 'rgba(0, 0, 0, 0.05)' }
            },
            y1: {
                type: 'linear' as const,
                display: true,
                position: 'right' as const,
                beginAtZero: true,
                title: { display: true, text: 'Jumlah WO' },
                grid: { drawOnChartArea: false }
            }
        }
    }

    // === ISSUE DISTRIBUTION (Doughnut for latest month) ===
    const latestIssue = issueTrend[issueTrend.length - 1]
    const issueChartData = {
        labels: latestIssue?.issues.slice(0, 6).map(i => i.issue) || [],
        datasets: [{
            data: latestIssue?.issues.slice(0, 6).map(i => i.count) || [],
            backgroundColor: [
                CHART_COLORS_ALPHA.red,
                CHART_COLORS_ALPHA.orange,
                CHART_COLORS_ALPHA.purple,
                CHART_COLORS_ALPHA.blue,
                CHART_COLORS_ALPHA.teal,
                CHART_COLORS_ALPHA.pink,
            ],
            borderColor: [
                CHART_COLORS.red,
                CHART_COLORS.orange,
                CHART_COLORS.purple,
                CHART_COLORS.blue,
                CHART_COLORS.teal,
                CHART_COLORS.pink,
            ],
            borderWidth: 2,
        }]
    }

    const issueChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right' as const,
                labels: { usePointStyle: true, padding: 10, font: { size: 11 } }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                callbacks: {
                    label: (context: { label: string; parsed: number }) => `${context.label}: ${context.parsed} WO`
                }
            }
        }
    }

    // === TYPE DISTRIBUTION (Horizontal Bar for latest month) ===
    const latestType = typeTrend[typeTrend.length - 1]
    const typeChartData = {
        labels: latestType?.types.slice(0, 6).map(t => t.type) || [],
        datasets: [{
            label: latestType?.month || 'Type',
            data: latestType?.types.slice(0, 6).map(t => t.count) || [],
            backgroundColor: [
                CHART_COLORS_ALPHA.blue,
                CHART_COLORS_ALPHA.green,
                CHART_COLORS_ALPHA.orange,
                CHART_COLORS_ALPHA.purple,
                CHART_COLORS_ALPHA.pink,
                CHART_COLORS_ALPHA.teal,
            ],
            borderColor: [
                CHART_COLORS.blue,
                CHART_COLORS.green,
                CHART_COLORS.orange,
                CHART_COLORS.purple,
                CHART_COLORS.pink,
                CHART_COLORS.teal,
            ],
            borderWidth: 2,
            borderRadius: 4,
        }]
    }

    const typeChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y' as const,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
            }
        },
        scales: {
            x: { beginAtZero: true, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
            y: { grid: { display: false } }
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            {/* Header with Date Range Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                        <HiArrowTrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Trend Analytics</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Analisis Work Order berdasarkan periode</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
                        <HiCalendarDays className="w-4 h-4 text-gray-500" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => onDateChange(e.target.value, endDate)}
                            className="bg-transparent text-sm border-none focus:ring-0 dark:text-white p-0"
                        />
                        <span className="text-gray-400">—</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => onDateChange(startDate, e.target.value)}
                            className="bg-transparent text-sm border-none focus:ring-0 dark:text-white p-0"
                        />
                    </div>
                    <button
                        onClick={onApply}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        <HiMagnifyingGlass className="w-4 h-4" />
                        {loading ? 'Loading...' : 'Terapkan'}
                    </button>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Volume Chart */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        📊 Volume Work Order
                        <span className="text-xs font-normal text-gray-500">(per bulan)</span>
                    </h3>
                    <div className="h-64">
                        {loading ? <ChartSkeleton /> : volumeTrend.length > 0 ? (
                            <Bar data={volumeChartData} options={volumeChartOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">Tidak ada data</div>
                        )}
                    </div>
                </div>

                {/* Performance Chart */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        ⚡ Performance Trend
                        <span className="text-xs font-normal text-gray-500">(waktu & volume)</span>
                    </h3>
                    <div className="h-64">
                        {loading ? <ChartSkeleton /> : performanceTrend.length > 0 ? (
                            <Line data={performanceChartData} options={performanceChartOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">Tidak ada data</div>
                        )}
                    </div>
                </div>

                {/* Issue Distribution */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        🔧 Distribusi Issue
                        <span className="text-xs font-normal text-gray-500">({latestIssue?.month || '-'})</span>
                    </h3>
                    <div className="h-64">
                        {loading ? <ChartSkeleton /> : latestIssue?.issues.length ? (
                            <Doughnut data={issueChartData} options={issueChartOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">Tidak ada data</div>
                        )}
                    </div>
                </div>

                {/* Type Distribution */}
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        📋 Distribusi Type WO
                        <span className="text-xs font-normal text-gray-500">({latestType?.month || '-'})</span>
                    </h3>
                    <div className="h-64">
                        {loading ? <ChartSkeleton /> : latestType?.types.length ? (
                            <Bar data={typeChartData} options={typeChartOptions} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-500">Tidak ada data</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
