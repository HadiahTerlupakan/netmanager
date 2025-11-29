"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiMagnifyingGlass,
    HiAdjustmentsHorizontal,
    HiPlus,
} from 'react-icons/hi2'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

type WorkOrder = {
    id: string
    workOrderNumber: string
    title: string
    type: string
    status: string
    priority: string
    scheduledDate: string | null
    pelanggan: {
        nama: string
        idPelanggan: string
    }
    assignedTo?: {
        firstName: string
        lastName: string
    } | null
    department?: {
        name: string
    } | null
    createdAt: string
}

const statusColors: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-800',
    ASSIGNED: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
    ON_HOLD: 'bg-orange-100 text-orange-800',
    COMPLETED: 'bg-green-100 text-green-800',
    VERIFIED: 'bg-emerald-100 text-emerald-800',
    CLOSED: 'bg-slate-100 text-slate-800',
    CANCELLED: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
    PENDING: 'Pending',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In Progress',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Completed',
    VERIFIED: 'Verified',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled',
}

const priorityColors: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-600',
    NORMAL: 'bg-blue-100 text-blue-600',
    HIGH: 'bg-orange-100 text-orange-600',
    URGENT: 'bg-red-100 text-red-600',
    CRITICAL: 'bg-purple-100 text-purple-600',
}

export default function WorkOrderListPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [showFilters, setShowFilters] = useState(false)

    // Filters
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterPriority, setFilterPriority] = useState('')
    const [filterType, setFilterType] = useState('')
    const [unassignedOnly, setUnassignedOnly] = useState(false)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }

        if (session?.user && status === 'authenticated') {
            fetchWorkOrders()
        }
    }, [session, status, router, page, search, filterStatus, filterPriority, filterType, unassignedOnly])

    const fetchWorkOrders = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            })

            if (search) params.append('search', search)
            if (filterStatus) params.append('status', filterStatus)
            if (filterPriority) params.append('priority', filterPriority)
            if (filterType) params.append('type', filterType)
            if (unassignedOnly) params.append('unassignedOnly', 'true')

            const response = await fetch(`/api/admin/workorders?${params}`)

            if (response.ok) {
                const result = await response.json()
                setWorkOrders(result.workOrders || [])
                setTotal(result.total || 0)
                setTotalPages(result.totalPages || 1)
            }
        } catch (error) {
            console.error('Error fetching work orders:', error)
        } finally {
            setLoading(false)
        }
    }

    const clearFilters = () => {
        setFilterStatus('')
        setFilterPriority('')
        setFilterType('')
        setUnassignedOnly(false)
        setSearch('')
    }

    const hasActiveFilters = filterStatus || filterPriority || filterType || unassignedOnly || search

    if (status === 'loading' || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Loading...</div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
                    <p className="text-gray-600 mt-1">Total {total} work orders</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        <HiAdjustmentsHorizontal className="w-5 h-5" />
                        <span>Filter</span>
                        {hasActiveFilters && <span className="w-2 h-2 bg-sky-500 rounded-full"></span>}
                    </button>
                    <Link
                        href="/admin/workorders/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                    >
                        <HiPlus className="w-5 h-5" />
                        <span>New Work Order</span>
                    </Link>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="bg-white rounded-lg shadow p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Filters</h3>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="text-sm text-sky-600 hover:text-sky-700 font-medium">
                                Reset
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="">All Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="ASSIGNED">Assigned</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="ON_HOLD">On Hold</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="VERIFIED">Verified</option>
                                <option value="CLOSED">Closed</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                            <select
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="">All Priority</option>
                                <option value="LOW">Low</option>
                                <option value="NORMAL">Normal</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                                <option value="CRITICAL">Critical</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                            >
                                <option value="">All Types</option>
                                <option value="INSTALLATION">Installation</option>
                                <option value="TROUBLESHOOT">Troubleshoot</option>
                                <option value="MAINTENANCE">Maintenance</option>
                                <option value="UPGRADE">Upgrade</option>
                                <option value="RELOCATION">Relocation</option>
                                <option value="DISCONNECTION">Disconnection</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Assignment</label>
                            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                                <input
                                    type="checkbox"
                                    checked={unassignedOnly}
                                    onChange={(e) => setUnassignedOnly(e.target.checked)}
                                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="text-sm text-gray-700">Unassigned Only</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by work order number, title..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">WO Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {workOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        {hasActiveFilters ? 'No work orders found with current filters' : 'No work orders yet'}
                                    </td>
                                </tr>
                            ) : (
                                workOrders.map((wo) => (
                                    <tr
                                        key={wo.id}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => router.push(`/admin/workorders/${wo.id}`)}
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{wo.workOrderNumber}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{wo.title}</div>
                                            <div className="text-xs text-gray-500">{wo.type}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900">{wo.pelanggan.nama}</div>
                                            <div className="text-xs text-gray-500">{wo.pelanggan.idPelanggan}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[wo.status]}`}>
                                                {statusLabels[wo.status]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${priorityColors[wo.priority]}`}>
                                                {wo.priority}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {wo.assignedTo ? `${wo.assignedTo.firstName} ${wo.assignedTo.lastName}` : (
                                                <span className="text-gray-400">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {formatDistanceToNow(new Date(wo.createdAt), { addSuffix: true, locale: localeId })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(page - 1)}
                            disabled={page === 1}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={page === totalPages}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
