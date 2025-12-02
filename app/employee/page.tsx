'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
    HiOutlineClock,
    HiOutlineCalendar,
    HiOutlineBanknotes,
    HiOutlineCheckCircle,
    HiOutlineUser,
    HiOutlineArrowTrendingUp,
    HiOutlineArrowTrendingDown,
    HiOutlineExclamationTriangle
} from 'react-icons/hi2'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import { StatCardSkeleton } from '@/components/ui/LoadingSkeleton'

interface DashboardStats {
    attendance: {
        thisMonth: number
        present: number
        late: number
        absent: number
    }
    leave: {
        annual: { total: number; used: number; remaining: number }
        sick: { total: number; used: number; remaining: number }
        pendingRequests: number
    }
    latestPayslip?: {
        month: number
        year: number
        netSalary: string
    }
}

export default function EmployeeDashboard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { showToast } = useToast()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/employee/login')
        } else if (status === 'authenticated' && session?.user) {
            loadDashboardData()
        }
    }, [status, session, router])

    const loadDashboardData = async () => {
        setLoading(true)
        try {
            const attendanceRes = await fetch('/api/hris/attendance/summary')
            const attendanceData = attendanceRes.ok ? await attendanceRes.json() : null

            const leaveRes = await fetch('/api/hris/leaves/balance')
            const leaveData = leaveRes.ok ? await leaveRes.json() : null

            const payslipRes = await fetch('/api/hris/payslips/latest')
            const payslipData = payslipRes.ok ? await payslipRes.json() : null

            setStats({
                attendance: attendanceData?.summary || {
                    thisMonth: 0,
                    present: 0,
                    late: 0,
                    absent: 0,
                },
                leave: leaveData?.balances || {
                    annual: { total: 12, used: 0, remaining: 12 },
                    sick: { total: 12, used: 0, remaining: 12 },
                    pendingRequests: 0,
                },
                latestPayslip: payslipData?.payslip || undefined,
            })
        } catch (error) {
            console.error('Error loading dashboard:', error)
            showToast('error', 'Failed to load dashboard data')
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: string) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(Number(amount))
    }

    const attendancePercentage = stats?.attendance?.thisMonth && stats.attendance.thisMonth > 0
        ? Math.round((stats.attendance.present / stats.attendance.thisMonth) * 100)
        : 0

    if (status === 'loading' || loading) {
        return (
            <div className="space-y-6 sm:space-y-8 fade-in">
                <div className="glass rounded-3xl shadow-xl p-8 sm:p-10 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-400/20 to-purple-400/20 rounded-full blur-3xl" />
                    <div className="relative">
                        <div className="h-10 w-64 skeleton rounded-lg mb-3" />
                        <div className="h-6 w-80 skeleton rounded-lg" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 sm:space-y-8 fade-in">
            {/* Hero Welcome Header */}
            <div className="relative overflow-hidden rounded-3xl shadow-2xl">
                <div className="absolute inset-0 gradient-vibrant opacity-95" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-48 -mt-48" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -ml-40 -mb-40" />

                <div className="relative p-6 sm:p-8 lg:p-10 text-white">
                    <p className="text-sm sm:text-base font-medium text-white/80 mb-2">
                        {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 leading-tight drop-shadow-md">
                        Selamat Datang, {session?.user?.name?.split(' ')[0] || 'Employee'}! 👋
                    </h1>
                    <p className="text-base sm:text-lg text-white/90 max-w-2xl">
                        Semoga harimu menyenangkan. Berikut ringkasan aktivitas dan informasi pentingmu hari ini.
                    </p>

                    {stats && stats.attendance.thisMonth > 0 && (
                        <div className="flex items-center gap-3 mt-6 p-4 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20">
                            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm">
                                {attendancePercentage >= 80 ? (
                                    <HiOutlineArrowTrendingUp className="w-7 h-7 text-white" />
                                ) : attendancePercentage >= 50 ? (
                                    <HiOutlineExclamationTriangle className="w-7 h-7 text-white" />
                                ) : (
                                    <HiOutlineArrowTrendingDown className="w-7 h-7 text-white" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-white/80 mb-1">Tingkat Kehadiran Bulan Ini</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl sm:text-3xl font-bold">{attendancePercentage}%</span>
                                    <span className="text-sm text-white/70">
                                        {stats.attendance.present} dari {stats.attendance.thisMonth} hari
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {stats && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                        {/* Attendance */}
                        <div className="group bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 sm:p-7 card-hover">
                            <div className="flex items-start justify-between mb-5">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Kehadiran Bulan Ini</p>
                                    <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{stats.attendance.thisMonth}</h3>
                                </div>
                                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform">
                                    <HiOutlineClock className="w-7 h-7 text-white" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500" />
                                        Hadir
                                    </span>
                                    <span className="text-base font-semibold text-green-600 dark:text-green-400">{stats.attendance.present}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                        Terlambat
                                    </span>
                                    <span className="text-base font-semibold text-yellow-600 dark:text-yellow-400">{stats.attendance.late}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500" />
                                        Tidak Hadir
                                    </span>
                                    <span className="text-base font-semibold text-red-600 dark:text-red-400">{stats.attendance.absent}</span>
                                </div>
                            </div>
                            <Link href="/employee/attendance" className="mt-5 flex items-center justify-center gap-2 w-full py-3 px-4 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl font-medium text-sm transition-all active:scale-95 touch-manipulation">
                                <HiOutlineClock className="w-5 h-5" />
                                Check In/Out
                            </Link>
                        </div>

                        {/* Leave Balance */}
                        <div className="group bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 sm:p-7 card-hover">
                            <div className="flex items-start justify-between mb-5">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Saldo Cuti</p>
                                    <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{stats.leave.annual.remaining + stats.leave.sick.remaining}</h3>
                                </div>
                                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
                                    <HiOutlineCalendar className="w-7 h-7 text-white" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Cuti Tahunan</span>
                                    <span className="text-base font-semibold text-gray-900 dark:text-white">{stats.leave.annual.remaining}/{stats.leave.annual.total} hari</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all" style={{ width: `${(stats.leave.annual.remaining / stats.leave.annual.total) * 100}%` }} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">Cuti Sakit</span>
                                    <span className="text-base font-semibold text-gray-900 dark:text-white">{stats.leave.sick.remaining}/{stats.leave.sick.total} hari</span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all" style={{ width: `${(stats.leave.sick.remaining / stats.leave.sick.total) * 100}%` }} />
                                </div>
                            </div>
                            {stats.leave.pendingRequests > 0 && (
                                <div className="mt-4 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dar:border-yellow-800 rounded-xl">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-400 font-medium text-center">{stats.leave.pendingRequests} pengajuan menunggu</p>
                                </div>
                            )}
                            <Link href="/employee/leaves" className="mt-5 flex items-center justify-center gap-2 w-full py-3 px-4 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl font-medium text-sm transition-all active:scale-95 touch-manipulation">
                                <HiOutlineCalendar className="w-5 h-5" />
                                Ajukan Cuti
                            </Link>
                        </div>

                        {/* Latest Payslip */}
                        <div className="group bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 sm:p-7 card-hover">
                            <div className="flex items-start justify-between mb-5">
                                <div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Slip Gaji Terakhir</p>
                                    {stats.latestPayslip && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500">
                                            {new Date(stats.latestPayslip.year, stats.latestPayslip.month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                        </p>
                                    )}
                                </div>
                                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform">
                                    <HiOutlineBanknotes className="w-7 h-7 text-white" />
                                </div>
                            </div>
                            {stats.latestPayslip ? (
                                <div className="space-y-2">
                                    <div className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white break-words">
                                        {formatCurrency(stats.latestPayslip.netSalary)}
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Gaji Bersih</p>
                                </div>
                            ) : (
                                <div className="py-8">
                                    <p className="text-center text-gray-500 dark:text-gray-400 text-sm">Belum ada slip gaji tersedia</p>
                                </div>
                            )}
                            <Link href="/employee/payslips" className="mt-5 flex items-center justify-center gap-2 w-full py-3 px-4 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 rounded-xl font-medium text-sm transition-all active:scale-95 touch-manipulation">
                                <HiOutlineBanknotes className="w-5 h-5" />
                                Lihat Semua
                            </Link>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 sm:p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <HiOutlineCheckCircle className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Aksi Cepat</h2>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <Link href="/employee/attendance" className="group flex flex-col items-center gap-4 p-6 sm:p-5 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all ripple touch-manipulation min-h-[130px] sm:min-h-[140px] bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50">
                                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg group-hover:scale-110 transition-transform">
                                    <HiOutlineClock className="w-7 h-7 text-white" />
                                </div>
                                <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white text-center">Absensi</span>
                            </Link>
                            <Link href="/employee/leaves" className="group flex flex-col items-center gap-4 p-6 sm:p-5 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-purple-500 hover:shadow-lg transition-all ripple touch-manipulation min-h-[130px] sm:min-h-[140px] bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50">
                                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg group-hover:scale-110 transition-transform">
                                    <HiOutlineCalendar className="w-7 h-7 text-white" />
                                </div>
                                <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white text-center">Ajukan Cuti</span>
                            </Link>
                            <Link href="/employee/payslips" className="group flex flex-col items-center gap-4 p-6 sm:p-5 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-green-500 hover:shadow-lg transition-all ripple touch-manipulation min-h-[130px] sm:min-h-[140px] bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50">
                                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-green-600 shadow-lg group-hover:scale-110 transition-transform">
                                    <HiOutlineBanknotes className="w-7 h-7 text-white" />
                                </div>
                                <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white text-center">Slip Gaji</span>
                            </Link>
                            <Link href="/employee/profile" className="group flex flex-col items-center gap-4 p-6 sm:p-5 border-2 border-gray-200 dark:border-gray-700 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all ripple touch-manipulation min-h-[130px] sm:min-h-[140px] bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-800/50">
                                <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg group-hover:scale-110 transition-transform">
                                    <HiOutlineUser className="w-7 h-7 text-white" />
                                </div>
                                <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white text-center">Profil Saya</span>
                            </Link>
                        </div>
                    </div>

                    {/* Info Notice */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-6 sm:p-7 shadow-md">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-blue-500 shadow-lg">
                                <span className="text-2xl">📢</span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3">Catatan Penting</h3>
                                <ul className="space-y-2.5 text-sm sm:text-base text-blue-800 dark:text-blue-200 leading-relaxed">
                                    <li className="flex items-start gap-3">
                                        <span className="text-blue-500 mt-0.5">•</span>
                                        <span>Jangan lupa absen setiap hari dengan geolocation aktif</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-blue-500 mt-0.5">•</span>
                                        <span>Ajukan cuti minimal 3 hari sebelumnya</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-blue-500 mt-0.5">•</span>
                                        <span>Slip gaji tersedia setiap tanggal 5 setiap bulan</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="text-blue-500 mt-0.5">•</span>
                                        <span>Update profil jika ada perubahan data pribadi</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
