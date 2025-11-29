"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiClipboardDocumentList,
    HiClock,
    HiCheckCircle,
    HiXCircle,
    HiWrenchScrewdriver,
} from 'react-icons/hi2'

type Statistics = {
    total: number
    pending: number
    assigned: number
    inProgress: number
    onHold: number
    completed: number
    verified: number
    closed: number
    cancelled: number
    avgCompletionTimeHours: number
    totalCost: number
    avgRating: number | null
    totalWithRating: number
}

export default function WorkOrderDashboard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<Statistics | null>(null)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }

        if (session?.user && status === 'authenticated') {
            fetchStats()
        }
    }, [session, status, router])

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/admin/workorders/stats')
            if (response.ok) {
                const result = await response.json()
                setStats(result.data)
            }
        } catch (error) {
            console.error('Error fetching statistics:', error)
        } finally {
            setLoading(false)
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Loading...</div>
            </div>
        )
    }

    const formatHours = (hours: number) => {
        if (hours < 1) return `${Math.round(hours * 60)} minutes`
        if (hours < 24) return `${hours.toFixed(1)} hours`
        return `${(hours / 24).toFixed(1)} days`
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Work Order Dashboard</h1>
                    <p className="text-gray-600 mt-1">Overview of all work orders</p>
                </div>
                <Link
                    href="/admin/workorders/list"
                    className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                >
                    View All Work Orders
                </Link>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Total Work Orders</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <HiClipboardDocumentList className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>

                        {/* Pending */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Pending</p>
                                    <p className="text-3xl font-bold text-orange-600 mt-1">{stats.pending}</p>
                                </div>
                                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <HiClock className="w-6 h-6 text-orange-600" />
                                </div>
                            </div>
                        </div>

                        {/* In Progress */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">In Progress</p>
                                    <p className="text-3xl font-bold text-yellow-600 mt-1">
                                        {stats.assigned + stats.inProgress}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                    <HiWrenchScrewdriver className="w-6 h-6 text-yellow-600" />
                                </div>
                            </div>
                        </div>

                        {/* Completed */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">Completed</p>
                                    <p className="text-3xl font-bold text-green-600 mt-1">
                                        {stats.completed + stats.verified}
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                    <HiCheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Avg Completion Time */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Avg Completion Time</h3>
                            <p className="text-2xl font-bold text-gray-900">
                                {formatHours(stats.avgCompletionTimeHours)}
                            </p>
                        </div>

                        {/* Total Cost */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Cost</h3>
                            <p className="text-2xl font-bold text-gray-900">
                                Rp {stats.totalCost.toLocaleString('id-ID')}
                            </p>
                        </div>

                        {/* Avg Rating */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="text-sm font-medium text-gray-600 mb-2">Customer Satisfaction</h3>
                            <p className="text-2xl font-bold text-gray-900">
                                {stats.avgRating ? `${stats.avgRating.toFixed(1)}/5` : 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{stats.totalWithRating} ratings</p>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Link
                            href="/admin/workorders/list?status=PENDING"
                            className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-lg p-6 hover:from-orange-600 hover:to-red-600 transition-all shadow-lg"
                        >
                            <h3 className="text-lg font-semibold mb-2">Pending Work Orders</h3>
                            <p className="text-white/90 text-sm mb-4">Handle unassigned work orders</p>
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <span>View Pending</span>
                                <span>→</span>
                            </div>
                        </Link>

                        <Link
                            href="/admin/workorders/list?status=IN_PROGRESS"
                            className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white rounded-lg p-6 hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg"
                        >
                            <h3 className="text-lg font-semibold mb-2">Active Work</h3>
                            <p className="text-white/90 text-sm mb-4">Track ongoing field work</p>
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <span>View Active</span>
                                <span>→</span>
                            </div>
                        </Link>

                        <Link
                            href="/admin/workorders/list?unassignedOnly=true"
                            className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-lg p-6 hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
                        >
                            <h3 className="text-lg font-semibold mb-2">Unassigned</h3>
                            <p className="text-white/90 text-sm mb-4">Assign to available technicians</p>
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <span>Manage Assignment</span>
                                <span>→</span>
                            </div>
                        </Link>
                    </div>
                </>
            )}
        </div>
    )
}
