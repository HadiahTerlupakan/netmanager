'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { HiOutlinePlus } from 'react-icons/hi2'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { LeaveBalanceSkeleton } from '@/components/ui/LoadingSkeleton'
import { EmptyState } from '@/components/ui/EmptyState'

interface LeaveBalance {
    leaveType: string
    totalDays: number
    usedDays: number
    remainingDays: number
}

interface LeaveRequest {
    id: string
    leaveType: string
    startDate: string
    endDate: string
    totalDays: number
    reason: string
    status: string
    createdAt: string
}

export default function EmployeeLeavePage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { showToast } = useToast()
    const [balances, setBalances] = useState<LeaveBalance[]>([])
    const [requests, setRequests] = useState<LeaveRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [showRequestForm, setShowRequestForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        leaveType: 'ANNUAL',
        startDate: '',
        endDate: '',
        reason: '',
    })

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/employee/login')
        } else if (status === 'authenticated') {
            loadData()
        }
    }, [status, router])

    const loadData = async () => {
        setLoading(true)
        try {
            // Fetch leave balances
            const balanceRes = await fetch('/api/hris/leaves/balance')
            if (balanceRes.ok) {
                const balanceData = await balanceRes.json()
                setBalances(balanceData.balances || [])
            }

            // Fetch leave requests
            const requestsRes = await fetch('/api/hris/leaves')
            if (requestsRes.ok) {
                const requestsData = await requestsRes.json()
                setRequests(requestsData.leaves || [])
            }
        } catch (error) {
            console.error('Error loading data:', error)
            showToast('error', 'Failed to load leave data')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        setSubmitting(true)

        try {
            const res = await fetch('/api/hris/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            })

            const data = await res.json()

            if (res.ok) {
                showToast('success', 'Leave request submitted successfully!')
                setShowRequestForm(false)
                setFormData({ leaveType: 'ANNUAL', startDate: '', endDate: '', reason: '' })
                loadData()
            } else {
                showToast('error', data.error || 'Failed to submit leave request')
            }
        } catch (error) {
            console.error('Error submitting leave:', error)
            showToast('error', 'Failed to submit leave request')
        } finally {
            setSubmitting(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const colors: Record<string, string> = {
            PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        }
        return <span className={`px-2 py-1 text-xs rounded-full font-medium ${colors[status]}`}>{status}</span>
    }

    if (status === 'loading' || loading) {
        return (
            <div className="space-y-6">
                <div className="text-center">
                    <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mx-auto mb-2 animate-pulse" />
                    <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse" />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <LeaveBalanceSkeleton />
                        <LeaveBalanceSkeleton />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Leave Management</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Check your leave balance and submit requests</p>
            </div>

            {/* Leave Balances */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Leave Balance</h2>
                {balances.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {balances.map((balance, index) => (
                            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-indigo-500 transition-colors">
                                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                                    {balance.leaveType}
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                            {balance.remainingDays}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">days remaining</div>
                                    </div>
                                    <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                                        Used: {balance.usedDays} / {balance.totalDays}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No leave balance information available
                    </p>
                )}
            </div>

            {/* Request Leave Button */}
            <button
                onClick={() => setShowRequestForm(true)}
                className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl shadow-lg hover:from-indigo-600 hover:to-purple-700 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
            >
                <HiOutlinePlus className="w-5 h-5" />
                Request Leave
            </button>

            {/* Request Form Modal */}
            <Modal
                isOpen={showRequestForm}
                onClose={() => !submitting && setShowRequestForm(false)}
                title="New Leave Request"
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Leave Type *
                        </label>
                        <select
                            value={formData.leaveType}
                            onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        >
                            <option value="ANNUAL">Annual Leave</option>
                            <option value="SICK">Sick Leave</option>
                            <option value="PERMISSION">Permission</option>
                            <option value="UNPAID">Unpaid Leave</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Start Date *
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            End Date *
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.endDate}
                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            min={formData.startDate || new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Reason *
                        </label>
                        <textarea
                            required
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            rows={3}
                            placeholder="Please provide a reason for your leave request"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowRequestForm(false)}
                            disabled={submitting}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Leave History */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Leave History</h2>
                {requests.length > 0 ? (
                    <div className="space-y-3">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-indigo-500 transition-colors"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            {request.leaveType}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {new Date(request.startDate).toLocaleDateString('id-ID')} -{' '}
                                            {new Date(request.endDate).toLocaleDateString('id-ID')} ({request.totalDays} days)
                                        </div>
                                    </div>
                                    {getStatusBadge(request.status)}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{request.reason}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="No leave requests yet"
                        description="You haven't submitted any leave requests. Click the button above to create your first request."
                    />
                )}
            </div>
        </div>
    )
}
