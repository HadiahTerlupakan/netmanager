'use client'

import { useState, useEffect } from 'react'
import {
    HiOutlineCalendar,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineClock
} from 'react-icons/hi2'

interface LeaveRequest {
    id: string
    leaveType: string
    startDate: string
    endDate: string
    totalDays: number
    reason: string
    status: string
    createdAt: string
    employee: {
        employeeId: string
        fullName: string
        department?: {
            name: string
        } | null
    }
}

export default function LeavesPage() {
    const [leaves, setLeaves] = useState<LeaveRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('ALL')
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 })

    useEffect(() => {
        fetchLeaves()
    }, [filter])

    const fetchLeaves = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (filter !== 'ALL') params.append('status', filter)

            const res = await fetch(`/api/hris/leaves?${params}`)
            const data = await res.json()

            if (res.ok) {
                setLeaves(data.leaves || [])

                // Calculate stats
                const allLeaves = data.leaves || []
                setStats({
                    pending: allLeaves.filter((l: LeaveRequest) => l.status === 'PENDING').length,
                    approved: allLeaves.filter((l: LeaveRequest) => l.status === 'APPROVED').length,
                    rejected: allLeaves.filter((l: LeaveRequest) => l.status === 'REJECTED').length,
                })
            }
        } catch (error) {
            console.error('Error fetching leaves:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (id: string) => {
        if (!confirm('Approve this leave request?')) return

        try {
            const res = await fetch(`/api/hris/leaves/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'APPROVED' }),
            })

            if (res.ok) {
                alert('Leave request approved!')
                fetchLeaves()
            } else {
                const data = await res.json()
                alert(`Error: ${data.error}`)
            }
        } catch (error) {
            console.error('Error approving leave:', error)
            alert('Failed to approve leave request')
        }
    }

    const handleReject = async (id: string) => {
        const reason = prompt('Rejection reason:')
        if (!reason) return

        try {
            const res = await fetch(`/api/hris/leaves/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'REJECTED', rejectionReason: reason }),
            })

            if (res.ok) {
                alert('Leave request rejected')
                fetchLeaves()
            } else {
                const data = await res.json()
                alert(`Error: ${data.error}`)
            }
        } catch (error) {
            console.error('Error rejecting leave:', error)
            alert('Failed to reject leave request')
        }
    }

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
        }

        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100'}`}>
                {status}
            </span>
        )
    }

    const getLeaveTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            ANNUAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            SICK: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
            PERMISSION: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
            MATERNITY: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
            PATERNITY: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
            UNPAID: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
        }

        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[type] || 'bg-gray-100'}`}>
                {type}
            </span>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leave Management</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Manage employee leave requests and approvals
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                                {stats.pending}
                            </p>
                        </div>
                        <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                            <HiOutlineClock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Approved</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                                {stats.approved}
                            </p>
                        </div>
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                            <HiOutlineCheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Rejected</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                                {stats.rejected}
                            </p>
                        </div>
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                            <HiOutlineXCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex items-center gap-2">
                    {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === f
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Leave Requests Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : leaves.length === 0 ? (
                    <div className="p-8 text-center">
                        <HiOutlineCalendar className="mx-auto w-12 h-12 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No leave requests</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Employee
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Leave Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Period
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Days
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Reason
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {leaves.map((leave) => (
                                    <tr key={leave.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {leave.employee.fullName}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {leave.employee.department?.name || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getLeaveTypeBadge(leave.leaveType)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {new Date(leave.startDate).toLocaleDateString('id-ID')} -{' '}
                                            {new Date(leave.endDate).toLocaleDateString('id-ID')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                            {leave.totalDays} days
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                                            {leave.reason}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(leave.status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            {leave.status === 'PENDING' && (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleApprove(leave.id)}
                                                        className="text-green-600 hover:text-green-900 dark:text-green-400"
                                                        title="Approve"
                                                    >
                                                        <HiOutlineCheckCircle className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(leave.id)}
                                                        className="text-red-600 hover:text-red-900 dark:text-red-400"
                                                        title="Reject"
                                                    >
                                                        <HiOutlineXCircle className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
