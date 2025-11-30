'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiMagnifyingGlass,
    HiMapPin,
    HiClock,
    HiCheckCircle,
    HiExclamationCircle,
    HiChevronRight
} from 'react-icons/hi2'

type WorkOrder = {
    id: string
    workOrderNumber: string
    title: string
    description: string
    type: string
    status: string
    priority: string
    pelanggan: {
        nama: string
        noTelp: string | null
    }
    assignedTo: {
        fullName: string
    } | null
    department: {
        name: string
    } | null
    locationAddress: string | null
    scheduledDate: string | null
    createdAt: string
}

type Stats = {
    assigned: number
    inProgress: number
    completed: number
}

type APIResponse = {
    success: boolean
    data: {
        workOrders: WorkOrder[]
        total: number
        stats: Stats
    }
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-800',
    ASSIGNED: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    VERIFIED: 'bg-green-100 text-green-800',
}

const PRIORITY_COLORS: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-600',
    NORMAL: 'bg-blue-100 text-blue-600',
    HIGH: 'bg-orange-100 text-orange-600',
    URGENT: 'bg-red-100 text-red-600',
    CRITICAL: 'bg-red-200 text-red-800',
}

export default function WorkOrdersPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [stats, setStats] = useState<Stats>({ assigned: 0, inProgress: 0, completed: 0 })
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadWorkOrders()
    }, [filter])

    const loadWorkOrders = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (filter !== 'all') {
                params.append('status', filter.toUpperCase())
            }
            if (searchQuery) {
                params.append('search', searchQuery)
            }

            const response = await fetch(`/api/employee/workorders?${params}`)
            if (response.ok) {
                const result: APIResponse = await response.json()
                setWorkOrders(result.data.workOrders)
                setStats(result.data.stats)
            }
        } catch (error) {
            console.error('Error loading work orders:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = () => {
        loadWorkOrders()
    }

    const employee = (session?.user as any)?.employee
    const departmentName = employee?.department?.name || 'Your Department'

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Work Orders
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Work orders assigned to {departmentName}
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Assigned</h3>
                        <HiClock className="w-5 h-5 text-yellow-600" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.assigned}</p>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">In Progress</h3>
                        <HiMapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.inProgress}</p>
                    )}
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</h3>
                        <HiCheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
                    )}
                </div>
            </div>

            {/* Search & Filter */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 flex gap-2">
                        <div className="flex-1 relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <HiMagnifyingGlass className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Search work orders..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                            Search
                        </button>
                    </div>

                    {/* Filter */}
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'all'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilter('assigned')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'assigned'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Assigned
                        </button>
                        <button
                            onClick={() => setFilter('in_progress')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'in_progress'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            In Progress
                        </button>
                        <button
                            onClick={() => setFilter('completed')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'completed'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            Completed
                        </button>
                    </div>
                </div>
            </div>

            {/* Work Orders List */}
            <div className="space-y-4">
                {loading ? (
                    // Loading skeletons
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 animate-pulse">
                            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                            <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                    ))
                ) : workOrders.length === 0 ? (
                    // Empty state
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                        <div className="inline-block p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                            <HiMapPin className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            No work orders found
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {filter === 'all'
                                ? `No work orders assigned to ${departmentName} yet.`
                                : `No ${filter.replace('_', ' ')} work orders at the moment.`}
                        </p>
                    </div>
                ) : (
                    // Work order cards
                    workOrders.map((wo) => (
                        <Link
                            key={wo.id}
                            href={`/employee/workorders/${wo.id}`}
                            className="block bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-md transition-shadow p-6"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {wo.workOrderNumber}
                                        </h3>
                                        <span className={`px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[wo.status] || 'bg-gray-100 text-gray-800'}`}>
                                            {wo.status.replace('_', ' ')}
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-medium rounded ${PRIORITY_COLORS[wo.priority] || 'bg-gray-100 text-gray-600'}`}>
                                            {wo.priority}
                                        </span>
                                    </div>
                                    <p className="text-gray-900 dark:text-white font-medium mb-1">{wo.title}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                        {wo.description}
                                    </p>
                                </div>
                                <HiChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Customer</p>
                                    <p className="text-gray-900 dark:text-white font-medium">{wo.pelanggan.nama}</p>
                                </div>
                                {wo.assignedTo && (
                                    <div>
                                        <p className="text-gray-500 dark:text-gray-400">Assigned To</p>
                                        <p className="text-gray-900 dark:text-white font-medium">{wo.assignedTo.fullName}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400">Created</p>
                                    <p className="text-gray-900 dark:text-white font-medium">{formatDate(wo.createdAt)}</p>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}
