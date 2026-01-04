"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
    HiPlus,
    HiMagnifyingGlass,
    HiAdjustmentsHorizontal,
    HiCheckCircle,
    HiXMark,
    HiTrash,
    HiXCircle,
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { useToast } from '@/components/common/ToastProvider'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'

interface WorkOrder {
    id: string
    workOrderNumber: string
    title: string
    type: string
    status: string
    priority: string
    scheduledDate: string | null
    contactName?: string | null
    pelanggan?: {
        nama: string
        idPelanggan: string
    } | null
    assignedTo?: {
        name: string
    } | null
    department?: {
        name: string
    } | null
    createdAt: string
}

const statusColors: Record<string, string> = {
    PENDING: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    ASSIGNED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
    IN_PROGRESS: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
    ON_HOLD: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200',
    COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    VERIFIED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200',
    CLOSED: 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200',
    CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
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
    LOW: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
    NORMAL: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    HIGH: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    URGENT: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    CRITICAL: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
}

export function ClientComponent() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { show } = useToast()
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

    // Approval states
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [processingApproval, setProcessingApproval] = useState(false)
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null)
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [cancelReason, setCancelReason] = useState('')

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

    const handleVerify = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Are you sure you want to verify this work order?')) return

        setProcessingApproval(true)
        try {
            const response = await fetch(`/api/admin/workorders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'VERIFIED' }),
            })

            if (response.ok) {
                fetchWorkOrders()
            } else {
                alert('Failed to verify work order')
            }
        } catch (error) {
            console.error('Error verifying:', error)
            alert('An error occurred')
        } finally {
            setProcessingApproval(false)
        }
    }

    const openRejectModal = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedWorkOrderId(id)
        setShowRejectModal(true)
    }

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            alert('Please provide a rejection reason')
            return
        }

        if (!selectedWorkOrderId) return

        setProcessingApproval(true)
        try {
            const response = await fetch(`/api/admin/workorders/${selectedWorkOrderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'IN_PROGRESS',
                    rejectionReason: rejectReason
                }),
            })

            if (response.ok) {
                setShowRejectModal(false)
                setRejectReason('')
                setSelectedWorkOrderId(null)
                fetchWorkOrders()
            } else {
                alert('Failed to reject work order')
            }
        } catch (error) {
            console.error('Error rejecting:', error)
            alert('An error occurred')
        } finally {
            setProcessingApproval(false)
        }
    }

    const openCancelModal = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedWorkOrderId(id)
        setShowCancelModal(true)
    }

    const handleCancel = async () => {
        if (!cancelReason.trim()) {
            alert('Please provide a cancellation reason')
            return
        }

        if (!selectedWorkOrderId) return

        setProcessingApproval(true)
        try {
            const response = await fetch(`/api/admin/workorders/${selectedWorkOrderId}?reason=${encodeURIComponent(cancelReason)}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                setShowCancelModal(false)
                setCancelReason('')
                setSelectedWorkOrderId(null)
                fetchWorkOrders()
            } else {
                alert('Failed to cancel work order')
            }
        } catch (error) {
            console.error('Error cancelling:', error)
            alert('An error occurred')
        } finally {
            setProcessingApproval(false)
        }
    }

    const openDeleteModal = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedWorkOrderId(id)
        setShowDeleteModal(true)
    }

    const handleDelete = async () => {
        if (!selectedWorkOrderId) return

        setProcessingApproval(true)
        try {
            const response = await fetch(`/api/admin/workorders/${selectedWorkOrderId}?permanent=true`, {
                method: 'DELETE',
            })

            if (response.ok) {
                setShowDeleteModal(false)
                setSelectedWorkOrderId(null)
                show({ type: 'success', message: 'Work Order berhasil dihapus permanen' })
                fetchWorkOrders()
            } else {
                show({ type: 'error', message: 'Gagal menghapus work order' })
            }
        } catch (error) {
            console.error('Error deleting:', error)
            show({ type: 'error', message: 'Terjadi kesalahan' })
        } finally {
            setProcessingApproval(false)
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

    // Define columns for ResponsiveTable
    const columns: Column<WorkOrder>[] = [
        {
            key: 'workOrderNumber',
            header: 'WO Number',
            priority: 'primary',
            render: (wo) => (
                <span className="text-sm font-medium text-gray-900 dark:text-white">{wo.workOrderNumber}</span>
            )
        },
        {
            key: 'title',
            header: 'Title',
            priority: 'primary',
            render: (wo) => (
                <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{wo.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{wo.type}</div>
                </div>
            )
        },
        {
            key: 'customer',
            header: 'Customer',
            priority: 'secondary',
            render: (wo) => (
                <div>
                    <div className="text-sm text-gray-900 dark:text-white">
                        {wo.pelanggan?.nama || wo.contactName || <span className="text-gray-400">Guest</span>}
                    </div>
                    {wo.pelanggan?.idPelanggan && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{wo.pelanggan.idPelanggan}</div>
                    )}
                </div>
            )
        },
        {
            key: 'status',
            header: 'Status',
            priority: 'primary',
            render: (wo) => (
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[wo.status]}`}>
                    {statusLabels[wo.status]}
                </span>
            )
        },
        {
            key: 'priority',
            header: 'Priority',
            priority: 'secondary',
            render: (wo) => (
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${priorityColors[wo.priority]}`}>
                    {wo.priority}
                </span>
            )
        },
        {
            key: 'assignedTo',
            header: 'Assigned To',
            priority: 'tertiary',
            render: (wo) => (
                <span className="text-sm text-gray-900 dark:text-white">
                    {wo.assignedTo ? wo.assignedTo.name : <span className="text-gray-400">Unassigned</span>}
                </span>
            )
        },
        {
            key: 'createdAt',
            header: 'Created',
            priority: 'tertiary',
            render: (wo) => (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDistanceToNow(new Date(wo.createdAt), { addSuffix: true, locale: localeId })}
                </span>
            )
        }
    ]

    // Render actions for each row
    const renderActions = (wo: WorkOrder) => (
        <>
            {wo.status !== 'CANCELLED' && wo.status !== 'CLOSED' && wo.status !== 'COMPLETED' && (
                <>
                    <button
                        onClick={(e) => openCancelModal(wo.id, e)}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                        title="Batalkan"
                    >
                        <HiXCircle className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => openDeleteModal(wo.id, e)}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Hapus Permanen"
                    >
                        <HiTrash className="w-5 h-5" />
                    </button>
                </>
            )}
            {wo.status === 'COMPLETED' && (
                <>
                    <button
                        onClick={(e) => openRejectModal(wo.id, e)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Tolak"
                    >
                        <HiXMark className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => handleVerify(wo.id, e)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Verifikasi"
                    >
                        <HiCheckCircle className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => openDeleteModal(wo.id, e)}
                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Hapus Permanen"
                    >
                        <HiTrash className="w-5 h-5" />
                    </button>
                </>
            )}
            {wo.status === 'CANCELLED' && (
                <button
                    onClick={(e) => openDeleteModal(wo.id, e)}
                    className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Hapus Permanen"
                >
                    <HiTrash className="w-5 h-5" />
                </button>
            )}
        </>
    )

    if (status === 'loading' || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <PageLoader />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Work Orders</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Total {total} work orders</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="text-sm text-sky-600 hover:text-sky-700 font-medium">
                                Reset
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Priority</label>
                            <select
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assignment</label>
                            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                                <input
                                    type="checkbox"
                                    checked={unassignedOnly}
                                    onChange={(e) => setUnassignedOnly(e.target.checked)}
                                    className="rounded border-gray-300 dark:border-gray-600 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Unassigned Only</span>
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
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <ResponsiveTable
                    data={workOrders}
                    columns={columns}
                    keyField="id"
                    loading={loading}
                    emptyMessage={hasActiveFilters ? 'No work orders found with current filters' : 'No work orders yet'}
                    loadingMessage="Memuat data..."
                    renderActions={renderActions}
                    onRowClick={(wo) => router.push(`/admin/workorders/${wo.id}`)}
                />
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(page - 1)}
                            disabled={page === 1}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 dark:text-gray-300"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={page === totalPages}
                            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 dark:text-gray-300"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tolak Hasil Pekerjaan</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Work order akan dikembalikan ke status In Progress. Silakan berikan alasan penolakan.
                            </p>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Alasan penolakan (wajib diisi)..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px] dark:bg-gray-700 dark:text-white"
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false)
                                        setRejectReason('')
                                        setSelectedWorkOrderId(null)
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={processingApproval || !rejectReason.trim()}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {processingApproval ? 'Memproses...' : 'Tolak & Kembalikan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Cancel Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Batalkan Work Order</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Tindakan ini tidak dapat dibatalkan. Work order akan ditandai sebagai Cancelled.
                            </p>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Alasan pembatalan (wajib diisi)..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px] dark:bg-gray-700 dark:text-white"
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowCancelModal(false)
                                        setCancelReason('')
                                        setSelectedWorkOrderId(null)
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                                >
                                    Kembali
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={processingApproval || !cancelReason.trim()}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {processingApproval ? 'Memproses...' : 'Batalkan WO'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Hapus Permanen Work Order?</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                Tindakan ini tidak dapat dibatalkan. Work Order beserta seluruh data terkait (tasks, history, lampiran) akan dihapus permanen dari database.
                            </p>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false)
                                        setSelectedWorkOrderId(null)
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={processingApproval}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {processingApproval ? 'Menghapus...' : 'Ya, Hapus Permanen'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
