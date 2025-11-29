'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
    HiOutlineClock,
    HiOutlineCalendar,
    HiOutlineBanknotes,
    HiOutlineCheckCircle
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
            // Fetch attendance stats
            const attendanceRes = await fetch('/api/hris/attendance/summary')
            const attendanceData = attendanceRes.ok ? await attendanceRes.json() : null

            // Fetch leave balance
            const leaveRes = await fetch('/api/hris/leaves/balance')
            const leaveData = leaveRes.ok ? await leaveRes.json() : null

            // Fetch latest payslip
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

    if (status === 'loading' || loading) {
        return (
            <div className="space-y-6">
                {/* Welcome Header Skeleton */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
                    <div className="h-8 w-48 bg-white/20 rounded mb-2 animate-pulse" />
                    <div className="h-4 w-64 bg-white/20 rounded animate-pulse" />
                </div>

                {/* Stats Skeletons */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-8 text-white">
                <h1 className="text-3xl font-bold mb-2">
                    Welcome Back, {session?.user?.name || 'Employee'}!
                </h1>
                <p className="text-indigo-100">Here's your overview for today</p>
            </div>

            {stats && (
                <>
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Attendance This Month */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Attendance This Month
                                </h3>
                                <HiOutlineClock className="w-8 h-8 text-indigo-600" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Present:</span>
                                    <span className="font-semibold text-green-600">{stats.attendance.present}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Late:</span>
                                    <span className="font-semibold text-yellow-600">{stats.attendance.late}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Absent:</span>
                                    <span className="font-semibold text-red-600">{stats.attendance.absent}</span>
                                </div>
                            </div>
                            <Link
                                href="/employee/attendance"
                                className="mt-4 block text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                Check In/Out →
                            </Link>
                        </div>

                        {/* Leave Balance */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Leave Balance
                                </h3>
                                <HiOutlineCalendar className="w-8 h-8 text-purple-600" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Annual:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {stats.leave.annual.remaining}/{stats.leave.annual.total} days
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">Sick:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {stats.leave.sick.remaining}/{stats.leave.sick.total} days
                                    </span>
                                </div>
                                {stats.leave.pendingRequests > 0 && (
                                    <div className="mt-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs text-yellow-800 dark:text-yellow-400">
                                        {stats.leave.pendingRequests} pending request(s)
                                    </div>
                                )}
                            </div>
                            <Link
                                href="/employee/leaves"
                                className="mt-4 block text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                Request Leave →
                            </Link>
                        </div>

                        {/* Latest Payslip */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Latest Payslip
                                </h3>
                                <HiOutlineBanknotes className="w-8 h-8 text-green-600" />
                            </div>
                            {stats.latestPayslip ? (
                                <div className="space-y-2">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {new Date(stats.latestPayslip.year, stats.latestPayslip.month - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {formatCurrency(stats.latestPayslip.netSalary)}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Net Salary</div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No payslip available</p>
                            )}
                            <Link
                                href="/employee/payslips"
                                className="mt-4 block text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                View All →
                            </Link>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Quick Actions
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Link
                                href="/employee/attendance"
                                className="group flex flex-col items-center gap-2 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
                            >
                                <HiOutlineClock className="w-8 h-8 text-indigo-600 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white text-center">Check In/Out</span>
                            </Link>
                            <Link
                                href="/employee/leaves"
                                className="group flex flex-col items-center gap-2 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                            >
                                <HiOutlineCalendar className="w-8 h-8 text-purple-600 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white text-center">Request Leave</span>
                            </Link>
                            <Link
                                href="/employee/payslips"
                                className="group flex flex-col items-center gap-2 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
                            >
                                <HiOutlineBanknotes className="w-8 h-8 text-green-600 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white text-center">View Payslips</span>
                            </Link>
                            <Link
                                href="/employee/profile"
                                className="group flex flex-col items-center gap-2 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                            >
                                <HiOutlineCheckCircle className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white text-center">My Profile</span>
                            </Link>
                        </div>
                    </div>

                    {/* Info Notice */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            📢 Important Notes
                        </h4>
                        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                            <li>Remember to check in/out every day with geolocation enabled</li>
                            <li>Submit leave requests at least 3 days in advance</li>
                            <li>Payslips are available on the 5th of each month</li>
                            <li>Update your profile if there are any changes to your information</li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    )
}
