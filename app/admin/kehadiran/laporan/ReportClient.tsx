'use client'

import React, { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { FaSearch, FaFileExport } from 'react-icons/fa'
import { MdTrendingUp, MdAccessTime, MdPeople, MdPersonOff, MdTimer } from 'react-icons/md'
import { Button } from '@/components/ui/Button'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'
import { fetchWithHandling, isFetchError, formatErrorMessage } from '@/lib/utils/fetch-wrapper'
import { validateDateRange } from '@/lib/utils/validation'

// Dynamic imports for Chart.js components
const Line = dynamic(() => import('react-chartjs-2').then(mod => mod.Line), {
    ssr: false,
    loading: () => <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse">Loading Chart...</div>
})
const Bar = dynamic(() => import('react-chartjs-2').then(mod => mod.Bar), {
    ssr: false,
    loading: () => <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse">Loading Chart...</div>
})

// Interfaces for report data
interface AttendanceTrend {
    date: string
    present: number
    late: number
}

interface OvertimeTrend {
    date: string
    duration: number
}

interface DepartmentStat {
    name: string
    present: number
    late: number
    duration?: number
}

interface SiteStat {
    name: string
    present: number
    late: number
    duration?: number
}

interface EmployeeSummary {
    userId: string
    user?: {
        name: string
        image?: string
        site?: { name: string }
        department?: { name: string }
    }
    hadir: number
    terlambat: number
    izin: number
    alpha: number
    lemburJam: number
    totalJamKerja: number
}

interface AttendanceSummary {
    totalAttendance: number
    attendanceRate: number
    avgDurationMinutes: number
    lateCount: number
    lateRate: number
    alphaCount: number
    alphaRate: number
}

interface OvertimeSummary {
    totalRequests: number
    totalDuration: number
    avgDuration: number
}

interface ReportData {
    attendance: {
        summary: AttendanceSummary
        trends: AttendanceTrend[]
        byDepartment: DepartmentStat[]
        bySite: SiteStat[]
        employeeSummary: EmployeeSummary[]
    }
    overtime: {
        summary: OvertimeSummary
        trends: OvertimeTrend[]
        byDepartment: DepartmentStat[]
        bySite: SiteStat[]
    }
}

export function ClientComponent() {
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<ReportData | null>(null)
    const [retryCountdown, setRetryCountdown] = useState<number | null>(null)

    // Filters
    const [startDate, setStartDate] = useState(() => {
        const now = new Date()
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    })
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [siteId, setSiteId] = useState('')
    const [departmentId, setDepartmentId] = useState('')

    // Debounced filters
    const debouncedStartDate = useDebounce(startDate, 300)
    const debouncedEndDate = useDebounce(endDate, 300)
    const debouncedSiteId = useDebounce(siteId, 300)
    const debouncedDepartmentId = useDebounce(departmentId, 300)

    // Options
    const [sites, setSites] = useState<{ id: string, name: string }[]>([])
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([])

    // Tab & Search for Rekap Karyawan
    const [activeTab, setActiveTab] = useState<'dashboard' | 'rekap'>('dashboard')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'hadir', direction: 'desc' })

    // Register ChartJS on mount
    useEffect(() => {
        const initChart = async () => {
             const {
              Chart: ChartJS,
              CategoryScale,
              LinearScale,
              BarElement,
              Title,
              Tooltip,
              Legend,
              PointElement,
              LineElement,
              ArcElement
            } = await import('chart.js')

            ChartJS.register(
              CategoryScale,
              LinearScale,
              BarElement,
              Title,
              Tooltip,
              Legend,
              PointElement,
              LineElement,
              ArcElement
            )
        }
        initChart()
    }, [])

    // Handle rate limit countdown
    useEffect(() => {
        if (retryCountdown !== null && retryCountdown > 0) {
            const timer = setTimeout(() => setRetryCountdown(retryCountdown - 1), 1000)
            return () => clearTimeout(timer)
        } else if (retryCountdown === 0) {
            setRetryCountdown(null)
        }
    }, [retryCountdown])

    const fetchOptionsCallback = useCallback(async () => {
        try {
            const response = await fetchWithHandling<{ sites: { id: string, name: string }[], departments: { id: string, name: string }[] }>('/api/admin/options')
            if (response.data) {
                setSites(response.data.sites || [])
                setDepartments(response.data.departments || [])
            }
        } catch (error) {
            if (isFetchError(error)) {
                showToast('error', formatErrorMessage(error))
            }
        }
    }, [showToast])

    const fetchReport = useCallback(async (signal?: AbortSignal) => {
        if (retryCountdown !== null) return

        // Validate date range
        const validation = validateDateRange(debouncedStartDate, debouncedEndDate)
        if (!validation.valid) {
            showToast('error', validation.error || 'Filter tidak valid')
            return
        }

        setLoading(true)
        try {
            const params: Record<string, string> = {
                startDate: debouncedStartDate,
                endDate: debouncedEndDate || '',
            }
            if (debouncedSiteId) params.siteId = debouncedSiteId
            if (debouncedDepartmentId) params.departmentId = debouncedDepartmentId

            const query = new URLSearchParams(params)

            const response = await fetchWithHandling<ReportData>(`/api/admin/reports/presence?${query.toString()}`, { signal })
            setData(response.data)
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return
            if (isFetchError(error)) {
                if (error.retryAfter) {
                    setRetryCountdown(error.retryAfter)
                }
                showToast('error', formatErrorMessage(error))
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false)
            }
        }
    }, [debouncedStartDate, debouncedEndDate, debouncedSiteId, debouncedDepartmentId, retryCountdown, showToast])

    useEffect(() => {
        fetchOptionsCallback()
    }, [fetchOptionsCallback])

    useEffect(() => {
        const controller = new AbortController()
        fetchReport(controller.signal)
        return () => controller.abort()
    }, [fetchReport])

    const formatDuration = (minutes: number) => {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return `${h}j ${m}m`
    }

    const handleExportCSV = () => {
        if (!data?.attendance?.employeeSummary) return

        const headers = ['Nama', 'Site', 'Departemen', 'Hadir', 'Terlambat', 'Izin', 'Alpha', 'Lembur (Jam)', 'Total Jam Kerja']
        const rows = data.attendance.employeeSummary.map((e: EmployeeSummary) => [
            `"${e.user?.name || '-'}"`,
            `"${e.user?.site?.name || '-'}"`,
            `"${e.user?.department?.name || '-'}"`,
            e.hadir,
            e.terlambat,
            e.izin,
            e.alpha,
            e.lemburJam,
            e.totalJamKerja
        ])

        const csvContent = [headers.join(','), ...rows.map((r: (string | number)[]) => r.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `rekap-karyawan-${startDate}-ke-${endDate}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const rekapColumns: Column<EmployeeSummary>[] = [
        {
            key: 'name',
            header: 'Karyawan',
            priority: 'primary',
            render: (item) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden shrink-0 relative">
                        { }
                        <img
                            src={item.user?.image || `https://ui-avatars.com/api/?name=${item.user?.name}&background=random`}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{item.user?.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{item.user?.department?.name || '-'}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'site',
            header: 'Site',
            priority: 'tertiary',
            render: (item) => <span className="text-xs text-gray-600 dark:text-gray-400">{item.user?.site?.name || '-'}</span>
        },
        {
            key: 'hadir',
            header: 'Hadir',
            priority: 'primary',
            align: 'center',
            sortable: true,
            render: (item) => <span className="font-bold text-blue-600 dark:text-blue-400">{item.hadir}</span>
        },
        {
            key: 'terlambat',
            header: 'Late',
            priority: 'secondary',
            align: 'center',
            sortable: true,
            render: (item) => <span className="text-yellow-600 font-medium">{item.terlambat}</span>
        },
        {
            key: 'izin',
            header: 'Izin',
            priority: 'secondary',
            align: 'center',
            sortable: true,
            render: (item) => <span className="text-green-600">{item.izin}</span>
        },
        {
            key: 'alpha',
            header: 'Alpha',
            priority: 'primary',
            align: 'center',
            sortable: true,
            render: (item) => <span className="text-red-600 font-bold">{item.alpha}</span>
        },
        {
            key: 'lemburJam',
            header: 'OT (j)',
            priority: 'secondary',
            align: 'center',
            sortable: true,
            render: (item) => <span className="text-purple-600">{item.lemburJam}</span>
        },
        {
            key: 'totalJamKerja',
            header: 'Total Jam',
            priority: 'primary',
            align: 'center',
            sortable: true,
            render: (item) => <span className="font-bold text-teal-600 dark:text-teal-400">{item.totalJamKerja}</span>
        }
    ]

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Laporan Kinerja Kehadiran & Lembur</h1>

            {/* Rate Limit Warning */}
            {retryCountdown !== null && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 dark:bg-yellow-900/20 dark:border-yellow-800">
                    <MdTimer className="text-yellow-600 text-xl" />
                    <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">Terlalu Banyak Permintaan</p>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            Mohon tunggu {retryCountdown} detik sebelum memuat ulang...
                        </p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Dari Tanggal</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sampai Tanggal</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Site</label>
                    <select
                        value={siteId}
                        onChange={e => setSiteId(e.target.value)}
                        className="border rounded px-3 py-2 text-sm w-32 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Semua Site</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Departemen</label>
                    <select
                        value={departmentId}
                        onChange={e => setDepartmentId(e.target.value)}
                        className="border rounded px-3 py-2 text-sm w-32 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="">Semua Dept</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <Button onClick={() => fetchReport()}
                    disabled={loading || retryCountdown !== null}
                    className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 flex items-center gap-2 h-[38px] disabled:opacity-50"
                >
                    <FaSearch /> {loading ? 'Memuat...' : 'Terapkan'}
                </Button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
                <Button 
                    variant="ghost"
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-2 font-medium text-sm transition-colors rounded-none border-b-2 ${activeTab === 'dashboard'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-transparent hover:bg-transparent'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                >
                    📊 Dashboard
                </Button>
                <Button 
                    variant="ghost"
                    onClick={() => setActiveTab('rekap')}
                    className={`px-4 py-2 font-medium text-sm transition-colors rounded-none border-b-2 ${activeTab === 'rekap'
                        ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-transparent hover:bg-transparent'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                >
                    👥 Rekap Karyawan
                </Button>
            </div>

            {loading && !data && (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400 italic">
                    <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
                    <p>Menganalisis data laporan...</p>
                </div>
            )}

            {data && activeTab === 'dashboard' && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-blue-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Total Kehadiran</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.attendance.summary.totalAttendance}</p>
                                </div>
                                <MdPeople className="text-3xl text-blue-200 dark:text-blue-900/40" />
                            </div>
                            <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                Rate: {data.attendance.summary.attendanceRate}%
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-teal-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Avg. Jam Kerja</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">
                                        {formatDuration(data.attendance.summary.avgDurationMinutes || 0)}
                                    </p>
                                </div>
                                <MdAccessTime className="text-3xl text-teal-200 dark:text-teal-900/40" />
                            </div>
                            <div className="mt-2 text-xs text-teal-600 dark:text-teal-400 font-medium">
                                per hari / karyawan
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-yellow-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Terlambat</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.attendance.summary.lateCount}</p>
                                </div>
                                <MdAccessTime className="text-3xl text-yellow-200 dark:text-yellow-900/40" />
                            </div>
                            <div className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                                {data.attendance.summary.lateRate.toFixed(1)}% dari total hadir
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-red-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Bolos (Alpha)</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.attendance.summary.alphaCount}</p>
                                </div>
                                <MdPersonOff className="text-3xl text-red-200 dark:text-red-900/40" />
                            </div>
                            <div className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
                                {data.attendance.summary.alphaRate.toFixed(1)}% dari total
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-purple-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Total Lembur</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.overtime.summary.totalRequests} <span className="text-sm font-normal text-gray-400">Request</span></p>
                                </div>
                                <MdTrendingUp className="text-3xl text-purple-200 dark:text-purple-900/40" />
                            </div>
                            <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 font-medium">
                                Total: {formatDuration(data.overtime.summary.totalDuration)}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-green-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Rata-rata Lembur</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.overtime.summary.avgDuration} <span className="text-sm font-normal text-gray-400">Menit</span></p>
                                </div>
                                <MdTrendingUp className="text-3xl text-green-200 dark:text-green-900/40" />
                            </div>
                            <div className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">
                                per karyawan aktif
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Attendance Trend */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Tren Kehadiran (Harian)</h3>
                            <div className="h-64">
                                <Line
                                    data={{
                                        labels: data.attendance.trends.map((t: AttendanceTrend) => t.date),
                                        datasets: [
                                            {
                                                label: 'Hadir',
                                                data: data.attendance.trends.map((t: AttendanceTrend) => t.present),
                                                borderColor: 'rgb(59, 130, 246)',
                                                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                                                tension: 0.3
                                            },
                                            {
                                                label: 'Terlambat',
                                                data: data.attendance.trends.map((t: AttendanceTrend) => t.late),
                                                borderColor: 'rgb(234, 179, 8)',
                                                backgroundColor: 'rgba(234, 179, 8, 0.5)',
                                                tension: 0.3
                                            }
                                        ]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { position: 'top' as const }
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Overtime Trend */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Tren Lembur (Menit)</h3>
                            <div className="h-64">
                                <Bar
                                    data={{
                                        labels: data.overtime.trends.map((t: OvertimeTrend) => t.date),
                                        datasets: [
                                            {
                                                label: 'Durasi Lembur (Menit)',
                                                data: data.overtime.trends.map((t: OvertimeTrend) => t.duration),
                                                backgroundColor: 'rgba(147, 51, 234, 0.6)',
                                                borderRadius: 4
                                            }
                                        ]
                                    }}
                                    options={{
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: { position: 'top' as const }
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Breakdowns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* By Department */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Performa per Departemen</h3>
                            <ResponsiveTable<DepartmentStat>
                                data={data.attendance.byDepartment}
                                loading={loading}
                                keyField="name"
                                columns={[
                                    {
                                        key: 'name',
                                        header: 'Departemen',
                                        priority: 'primary',
                                        render: (item) => <span className="font-medium text-sm">{item.name}</span>
                                    },
                                    {
                                        key: 'present',
                                        header: 'Hadir',
                                        priority: 'primary',
                                        align: 'center',
                                        render: (item) => <span className="font-bold text-blue-600">{item.present}</span>
                                    },
                                    {
                                        key: 'late',
                                        header: 'Late',
                                        priority: 'secondary',
                                        align: 'center',
                                        render: (item) => <span className="text-yellow-600">{item.late}</span>
                                    },
                                    {
                                        key: 'overtime',
                                        header: 'OT (jam)',
                                        priority: 'secondary',
                                        align: 'center',
                                        render: (item) => {
                                            const ot = data.overtime.byDepartment.find((o: DepartmentStat) => o.name === item.name)
                                            return <span className="text-purple-600 font-medium">{ot?.duration ? (ot.duration / 60).toFixed(1) : '0.0'}</span>
                                        }
                                    }
                                ]}
                            />
                        </div>

                        {/* By Site */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Performa per Site</h3>
                            <ResponsiveTable<SiteStat>
                                data={data.attendance.bySite}
                                loading={loading}
                                keyField="name"
                                columns={[
                                    {
                                        key: 'name',
                                        header: 'Site',
                                        priority: 'primary',
                                        render: (item) => <span className="font-medium text-sm">{item.name}</span>
                                    },
                                    {
                                        key: 'present',
                                        header: 'Hadir',
                                        priority: 'primary',
                                        align: 'center',
                                        render: (item) => <span className="font-bold text-blue-600">{item.present}</span>
                                    },
                                    {
                                        key: 'late',
                                        header: 'Late',
                                        priority: 'secondary',
                                        align: 'center',
                                        render: (item) => <span className="text-yellow-600">{item.late}</span>
                                    },
                                    {
                                        key: 'overtime',
                                        header: 'OT (jam)',
                                        priority: 'secondary',
                                        align: 'center',
                                        render: (item) => {
                                            const ot = data.overtime.bySite.find((o: SiteStat) => o.name === item.name)
                                            return <span className="text-purple-600 font-medium">{ot?.duration ? (ot.duration / 60).toFixed(1) : '0.0'}</span>
                                        }
                                    }
                                ]}
                            />
                        </div>
                    </div>
                </>
            )}

            {/* Tab Rekap Karyawan */}
            {data && activeTab === 'rekap' && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                    <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                            Rekap Kehadiran Karyawan
                        </h3>
                        <div className="flex gap-2 items-center">
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                                <input
                                    type="text"
                                    placeholder="Cari nama..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="border rounded pl-8 pr-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white w-48"
                                />
                            </div>
                            <Button variant="success"
                                onClick={handleExportCSV}
                                
                            >
                                <FaFileExport /> Export CSV
                            </Button>
                        </div>
                    </div>

                    <ResponsiveTable<EmployeeSummary>
                        data={(() => {
                            let filtered = data?.attendance?.employeeSummary || []

                            // Search filter
                            if (searchQuery) {
                                filtered = filtered.filter((e: EmployeeSummary) =>
                                    e.user?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                                )
                            }

                            // Sort
                            filtered = [...filtered].sort((a: EmployeeSummary, b: EmployeeSummary) => {
                                const aVal = (a as unknown as Record<string, unknown>)[sortConfig.key] as number || 0
                                const bVal = (b as unknown as Record<string, unknown>)[sortConfig.key] as number || 0
                                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
                            })

                            return filtered
                        })()}
                        loading={loading}
                        keyField="userId"
                        columns={rekapColumns}
                        sortColumn={sortConfig.key}
                        sortDirection={sortConfig.direction}
                        onSort={(key, dir) => setSortConfig({ key, direction: dir })}
                        emptyMessage="Tidak ada data karyawan sesuai filter"
                    />
                </div>
            )}
        </div>
    )
}
