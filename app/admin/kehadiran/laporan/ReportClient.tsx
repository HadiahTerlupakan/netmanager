'use client'

import React, { useState, useEffect } from 'react'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    PointElement,
    LineElement,
    ArcElement
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { FaCalendarAlt, FaSearch } from 'react-icons/fa'
import { MdTrendingUp, MdTrendingDown, MdAccessTime, MdPeople } from 'react-icons/md'
import toast from 'react-hot-toast'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

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

export function ClientComponent() {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<any>(null)

    // Filters
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
    const [siteId, setSiteId] = useState('')
    const [departmentId, setDepartmentId] = useState('')

    // Options
    const [sites, setSites] = useState<{ id: string, name: string }[]>([])
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([])

    const fetchOptions = async () => {
        try {
            const res = await fetch('/api/admin/options')
            if (res.ok) {
                const data = await res.json()
                setSites(data.sites)
                setDepartments(data.departments)
            }
        } catch (error) {
            console.error('Failed to fetch options')
        }
    }

    const fetchReport = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({ startDate, endDate })
            if (siteId) params.append('siteId', siteId)
            if (departmentId) params.append('departmentId', departmentId)

            const res = await fetch(`/api/admin/reports/presence?${params.toString()}`)
            const json = await res.json()

            if (json.success) {
                setData(json.data)
            } else {
                toast.error(json.error || 'Gagal memuat laporan')
            }
        } catch (error) {
            toast.error('Terjadi kesalahan')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchOptions()
        fetchReport()
    }, [])

    const formatDuration = (minutes: number) => {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return `${h}j ${m}m`
    }

    if (!data && loading) return <div className="p-8 text-center text-gray-500">Sedang memuat laporan...</div>

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Laporan Kinerja Kehadiran & Lembur</h1>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Dari Tanggal</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sampai Tanggal</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Site</label>
                    <select value={siteId} onChange={e => setSiteId(e.target.value)} className="border rounded px-3 py-2 text-sm w-32 dark:bg-gray-700 dark:border-gray-600">
                        <option value="">Semua</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Departemen</label>
                    <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} className="border rounded px-3 py-2 text-sm w-32 dark:bg-gray-700 dark:border-gray-600">
                        <option value="">Semua</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                </div>
                <button onClick={fetchReport} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 flex items-center gap-2 h-[38px]">
                    <FaSearch /> Terapkan
                </button>
            </div>

            {data && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-blue-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Total Kehadiran</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.attendance.summary.totalAttendance}</p>
                                </div>
                                <MdPeople className="text-3xl text-blue-200" />
                            </div>
                            <div className="mt-2 text-xs text-blue-600 font-medium">
                                Rate: {data.attendance.summary.attendanceRate}%
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-teal-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Rata-rata Jam Kerja</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">
                                        {formatDuration(data.attendance.summary.avgDurationMinutes || 0)}
                                    </p>
                                </div>
                                <MdAccessTime className="text-3xl text-teal-200" />
                            </div>
                            <div className="mt-2 text-xs text-teal-600 font-medium">
                                per hari / karyawan
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-yellow-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Terlambat</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.attendance.summary.lateCount}</p>
                                </div>
                                <MdAccessTime className="text-3xl text-yellow-200" />
                            </div>
                            <div className="mt-2 text-xs text-yellow-600 font-medium">
                                {data.attendance.summary.lateRate.toFixed(1)}% dari total hadir
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-purple-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Total Lembur</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.overtime.summary.totalRequests} <span className="text-sm font-normal text-gray-400">Request</span></p>
                                </div>
                                <MdTrendingUp className="text-3xl text-purple-200" />
                            </div>
                            <div className="mt-2 text-xs text-purple-600 font-medium">
                                Total: {formatDuration(data.overtime.summary.totalDuration)}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-l-4 border-green-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-500 text-sm">Rata-rata Lembur</p>
                                    <p className="text-2xl font-bold text-gray-800 dark:text-white">{data.overtime.summary.avgDuration} <span className="text-sm font-normal text-gray-400">Menit</span></p>
                                </div>
                                <MdTrendingUp className="text-3xl text-green-200" />
                            </div>
                            <div className="mt-2 text-xs text-green-600 font-medium">
                                per karyawan aktif
                            </div>
                        </div>
                    </div>

                    {/* Top Employees */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Most Diligent */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                <span className="text-2xl">⚡</span> Paling Rajin
                                <span className="text-xs font-normal text-gray-500">(Kehadiran)</span>
                            </h3>
                            <div className="space-y-3">
                                {data.attendance.topEmployees.length === 0 ? (
                                    <p className="text-gray-400 text-sm italic">Belum ada data.</p>
                                ) : (
                                    data.attendance.topEmployees.map((item: any, idx: number) => (
                                        <div key={item.user.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                            <div className="font-bold text-gray-400 w-4">#{idx + 1}</div>
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden shrink-0">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={item.user.image || `https://ui-avatars.com/api/?name=${item.user.name}&background=random`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.user.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{item.user.department?.name || '-'}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-blue-600">{item.count}</div>
                                                <div className="text-[10px] text-gray-400">Hari Hadir</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Top Overtime */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                <span className="text-2xl">⚡</span> Paling Lembur
                                <span className="text-xs font-normal text-gray-500">(Total Durasi)</span>
                            </h3>
                            <div className="space-y-3">
                                {data.overtime.topEmployees.length === 0 ? (
                                    <p className="text-gray-400 text-sm italic">Belum ada data.</p>
                                ) : (
                                    data.overtime.topEmployees.map((item: any, idx: number) => (
                                        <div key={item.user.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                                            <div className="font-bold text-gray-400 w-4">#{idx + 1}</div>
                                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden shrink-0">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={item.user.image || `https://ui-avatars.com/api/?name=${item.user.name}&background=random`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.user.name}</p>
                                                <p className="text-xs text-gray-500 truncate">{item.user.site?.name || '-'}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-purple-600">{formatDuration(item.totalDuration)}</div>
                                                <div className="text-[10px] text-gray-400">Total Durasi</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Top Overall (Accumulated) */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border-2 border-indigo-500/20 relative overflow-hidden">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-linear-to-br from-indigo-500 to-purple-500 rounded-full opacity-10 blur-xl"></div>
                            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200 flex items-center gap-2 relative z-10">
                                <span className="text-2xl">👑</span> Star Employees
                                <span className="text-xs font-normal text-gray-500">(Overall Score)</span>
                            </h3>
                            <div className="space-y-3 relative z-10">
                                {data.attendance.combinedTopEmployees?.length === 0 ? (
                                    <p className="text-gray-400 text-sm italic">Belum ada data cukup.</p>
                                ) : (
                                    data.attendance.combinedTopEmployees?.map((item: any, idx: number) => (
                                        <div key={item.user.id} className="flex items-center gap-3 p-2 rounded-lg bg-linear-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-gray-800 border border-indigo-100 dark:border-indigo-900/50">
                                            <div className={`font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs ${idx === 0 ? 'bg-yellow-400 text-white shadow-sm' : idx === 1 ? 'bg-gray-300 text-white' : idx === 2 ? 'bg-amber-600 text-white' : 'text-gray-400'}`}>
                                                {idx + 1}
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white dark:ring-gray-700 shadow-sm">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={item.user.image || `https://ui-avatars.com/api/?name=${item.user.name}&background=random`}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{item.user.name}</p>
                                                <div className="flex gap-2 text-[10px] text-gray-500">
                                                    <span>📅 {item.details.days}</span>
                                                    <span>⚡ {item.details.otHours}j</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{item.score}</div>
                                                <div className="text-[10px] text-gray-400">Poin</div>
                                            </div>
                                        </div>
                                    ))
                                )}
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
                                        labels: data.attendance.trends.map((t: any) => t.date),
                                        datasets: [
                                            {
                                                label: 'Hadir',
                                                data: data.attendance.trends.map((t: any) => t.present),
                                                borderColor: 'rgb(59, 130, 246)',
                                                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                                            },
                                            {
                                                label: 'Terlambat',
                                                data: data.attendance.trends.map((t: any) => t.late),
                                                borderColor: 'rgb(234, 179, 8)',
                                                backgroundColor: 'rgba(234, 179, 8, 0.5)',
                                            }
                                        ]
                                    }}
                                    options={{ responsive: true, maintainAspectRatio: false }}
                                />
                            </div>
                        </div>

                        {/* Overtime Trend */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Tren Lembur (Menit)</h3>
                            <div className="h-64">
                                <Bar
                                    data={{
                                        labels: data.overtime.trends.map((t: any) => t.date),
                                        datasets: [
                                            {
                                                label: 'Durasi Lembur (Menit)',
                                                data: data.overtime.trends.map((t: any) => t.duration),
                                                backgroundColor: 'rgba(147, 51, 234, 0.6)',
                                            }
                                        ]
                                    }}
                                    options={{ responsive: true, maintainAspectRatio: false }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Breakdown Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* By Department */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Performa per Departemen</h3>
                            <ResponsiveTable<any>
                                data={data.attendance.byDepartment}
                                loading={loading}
                                keyField="name"
                                columns={[
                                    {
                                        key: 'name',
                                        header: 'Departemen',
                                        priority: 'primary',
                                        render: (item) => <span className="font-medium">{item.name}</span>
                                    },
                                    {
                                        key: 'present',
                                        header: 'Hadir',
                                        priority: 'primary',
                                        render: (item) => <span className="text-right block">{item.present}</span>
                                    },
                                    {
                                        key: 'late',
                                        header: 'Terlambat',
                                        priority: 'secondary',
                                        render: (item) => <span className="text-right text-yellow-600 block">{item.late}</span>
                                    },
                                    {
                                        key: 'overtime',
                                        header: 'Lembur (Jam)',
                                        priority: 'secondary',
                                        render: (item) => {
                                            const ot = data.overtime.byDepartment.find((o: any) => o.name === item.name)
                                            return <span className="text-right text-purple-600 block">{ot ? (ot.duration / 60).toFixed(1) : '0.0'}</span>
                                        }
                                    }
                                ]}
                                emptyMessage="Tidak ada data departemen"
                            />
                        </div>

                        {/* By Site */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">Performa per Site</h3>
                            <ResponsiveTable<any>
                                data={data.attendance.bySite}
                                loading={loading}
                                keyField="name"
                                columns={[
                                    {
                                        key: 'name',
                                        header: 'Site',
                                        priority: 'primary',
                                        render: (item) => <span className="font-medium">{item.name}</span>
                                    },
                                    {
                                        key: 'present',
                                        header: 'Hadir',
                                        priority: 'primary',
                                        render: (item) => <span className="text-right block">{item.present}</span>
                                    },
                                    {
                                        key: 'late',
                                        header: 'Terlambat',
                                        priority: 'secondary',
                                        render: (item) => <span className="text-right text-yellow-600 block">{item.late}</span>
                                    },
                                    {
                                        key: 'overtime',
                                        header: 'Lembur (Jam)',
                                        priority: 'secondary',
                                        render: (item) => {
                                            const ot = data.overtime.bySite.find((o: any) => o.name === item.name)
                                            return <span className="text-right text-purple-600 block">{ot ? (ot.duration / 60).toFixed(1) : '0.0'}</span>
                                        }
                                    }
                                ]}
                                emptyMessage="Tidak ada data site"
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
