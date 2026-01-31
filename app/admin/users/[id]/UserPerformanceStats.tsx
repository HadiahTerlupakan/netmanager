'use client'

import { useEffect, useState } from 'react'
import {
    HiOutlineBriefcase,
    HiOutlineClock,
    HiOutlineStar,
    HiOutlineCalendarDays,
} from 'react-icons/hi2'

interface PerformanceData {
    workingHourMode: 'FIXED' | 'SHIFT' | 'FLEXIBLE'
    attendance: {
        present: number
        late: number
        absent: number
        alpha: number
        total: number
    }
    flexibleStats: {
        totalMinutesThisMonth: number
        totalHoursThisMonth: number
        daysWorkedThisMonth: number
        avgHoursPerDay: number
        targetHoursPerDay: number
        targetPercentage: number
    }
    leaves: {
        cuti: number
        sakit: number
        izin: number
        lainnya: number
        tukarLibur: number
        total: number
    }
    workOrders: {
        totalAssigned: number
        completed: number
        active: number
        completionRate: number
        avgRating: number
    }
}

export default function UserPerformanceStats({ userId }: { userId: string }) {
    const [data, setData] = useState<PerformanceData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`/api/admin/users/${userId}/performance`)
                if (!res.ok) {
                    const errorText = await res.text()
                    try {
                        const errorJson = JSON.parse(errorText)
                        throw new Error(errorJson.error || `Request failed with status ${res.status}`)
                    } catch (_e: unknown) {
                        throw new Error(`Request failed: ${res.status} ${errorText.substring(0, 50)}`)
                    }
                }
                const json = await res.json()
                setData(json.data)
            } catch (err: unknown) {
                console.error(err)
                const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
                setError(message)
            } finally {
                setLoading(false)
            }
        }

        if (userId) fetchStats()
    }, [userId])

    if (loading) return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 animate-pulse h-48"></div>
    )

    if (error || !data) return null

    const isFlexible = data.workingHourMode === 'FLEXIBLE'

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HiOutlineChartBarSquare className="w-6 h-6 text-indigo-500" />
                Statistik Performa & Kehadiran
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Attendance Card - Different for FLEXIBLE */}
                {isFlexible ? (
                    // FLEXIBLE Mode: Show working hours stats
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <HiOutlineClock className="w-5 h-5 text-green-500" />
                                Jam Kerja (Bulan Ini)
                            </h3>
                            <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-1 rounded-full dark:bg-green-900/30 dark:text-green-300">
                                FLEXIBLE
                            </span>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Total Jam Bulan Ini</span>
                                <span className="font-bold text-2xl text-green-600 dark:text-green-400">
                                    {data.flexibleStats.totalHoursThisMonth}
                                    <span className="text-sm font-normal text-gray-500 ml-1">jam</span>
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Hari Kerja</span>
                                <span className="font-bold text-gray-900 dark:text-white">{data.flexibleStats.daysWorkedThisMonth} hari</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Rata-rata/Hari</span>
                                <span className="font-bold text-gray-900 dark:text-white">{data.flexibleStats.avgHoursPerDay} jam</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Target/Hari</span>
                                <span className="font-medium text-gray-500">{data.flexibleStats.targetHoursPerDay} jam</span>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="pt-2">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Pencapaian Target</span>
                                    <span className={data.flexibleStats.targetPercentage >= 100 ? 'text-green-600' : 'text-orange-500'}>
                                        {data.flexibleStats.targetPercentage}%
                                    </span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div 
                                        style={{ width: `${data.flexibleStats.targetPercentage}%` }} 
                                        className={`h-full rounded-full ${data.flexibleStats.targetPercentage >= 100 ? 'bg-green-500' : 'bg-orange-500'}`} 
                                    />
                                </div>
                            </div>

                            <p className="text-xs text-green-600 dark:text-green-400 mt-2 bg-green-50 dark:bg-green-900/10 p-2 rounded">
                                ✅ Mode FLEXIBLE: Tidak ada ALPHA, yang dihitung adalah akumulasi jam kerja.
                            </p>
                        </div>
                    </div>
                ) : (
                    // FIXED/SHIFT Mode: Traditional attendance stats
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <HiOutlineClock className="w-5 h-5 text-blue-500" />
                                Kehadiran (30 Hari)
                            </h3>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                data.workingHourMode === 'SHIFT' 
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            }`}>
                                {data.workingHourMode}
                            </span>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center text-gray-600 dark:text-gray-400">
                                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                    Hadir Tepat Waktu
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white">{data.attendance.present}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center text-gray-600 dark:text-gray-400">
                                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                                    Terlambat
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white">{data.attendance.late}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center text-gray-600 dark:text-gray-400">
                                    <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                                    Mangkir
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white">{data.attendance.absent}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="flex items-center text-gray-600 dark:text-gray-400">
                                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                    Alpha (Tidak Masuk)
                                </span>
                                <span className="font-bold text-gray-900 dark:text-white">{data.attendance.alpha}</span>
                            </div>
                            
                            {/* Simple Bar */}
                            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex mt-2">
                                <div style={{ width: `${(data.attendance.present / Math.max(data.attendance.total, 1)) * 100}%` }} className="h-full bg-green-500" />
                                <div style={{ width: `${(data.attendance.late / Math.max(data.attendance.total, 1)) * 100}%` }} className="h-full bg-yellow-500" />
                                <div style={{ width: `${(data.attendance.absent / Math.max(data.attendance.total, 1)) * 100}%` }} className="h-full bg-orange-500" />
                                <div style={{ width: `${(data.attendance.alpha / Math.max(data.attendance.total, 1)) * 100}%` }} className="h-full bg-red-500" />
                            </div>
                            <p className="text-xs text-gray-500 text-right">Total: {data.attendance.total} hari</p>
                        </div>
                    </div>
                )}

                {/* 2. Work Order Performance */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <HiOutlineBriefcase className="w-5 h-5 text-purple-500" />
                            Work Orders
                        </h3>
                        <div className="flex items-center gap-1 text-yellow-500">
                            <HiOutlineStar className="w-4 h-4 fill-yellow-500" />
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{data.workOrders.avgRating}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg text-center">
                            <p className="text-xs text-purple-600 dark:text-purple-300 uppercase font-bold">Selesai</p>
                            <p className="text-xl font-bold text-purple-700 dark:text-purple-200">{data.workOrders.completed}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-center">
                            <p className="text-xs text-gray-500 uppercase font-bold">Total</p>
                            <p className="text-xl font-bold text-gray-700 dark:text-gray-200">{data.workOrders.totalAssigned}</p>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Success Rate</span>
                            <span>{data.workOrders.completionRate}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div style={{ width: `${data.workOrders.completionRate}%` }} className="h-full bg-purple-500 rounded-full" />
                        </div>
                        <p className="text-xs text-gray-400 mt-1 text-right">Active Tasks: {data.workOrders.active}</p>
                    </div>
                </div>

                {/* 3. Leave History Summary */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <HiOutlineCalendarDays className="w-5 h-5 text-orange-500" />
                            Cuti & Izin (All Time)
                        </h3>
                        <span className="text-xs font-medium bg-orange-100 text-orange-800 px-2 py-1 rounded-full dark:bg-orange-900/30 dark:text-orange-300">
                            Total: {data.leaves.total}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                        <LeaveItem label="Cuti Tahunan" value={data.leaves.cuti} color="bg-blue-500" />
                        <LeaveItem label="Sakit" value={data.leaves.sakit} color="bg-red-500" />
                        <LeaveItem label="Izin" value={data.leaves.izin} color="bg-yellow-500" />
                        <LeaveItem label="Tukar Libur" value={data.leaves.tukarLibur} color="bg-teal-500" />
                        <LeaveItem label="Lainnya" value={data.leaves.lainnya} color="bg-gray-500" />
                    </div>
                </div>

            </div>
        </div>
    )
}

function LeaveItem({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
            <span className="text-gray-600 dark:text-gray-400 text-xs">{label}</span>
            <div className="flex items-center gap-2">
                 <span className={`w-1.5 h-1.5 rounded-full ${color}`}></span>
                 <span className="font-bold text-gray-900 dark:text-white">{value}</span>
            </div>
        </div>
    )
}

function HiOutlineChartBarSquare(props: React.ComponentProps<'svg'>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  )
}

