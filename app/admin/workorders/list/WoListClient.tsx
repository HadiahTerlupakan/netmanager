"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { intervalToDuration, formatDuration, format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
    HiPlus,
    HiMagnifyingGlass,
    HiAdjustmentsHorizontal,
    HiCheckCircle,
    HiXMark,
    HiTrash,
    HiXCircle,
    HiBellAlert,
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { useToast } from '@/hooks/use-toast'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'

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
    site?: {
        name: string
    } | null
    createdBy?: {
        name: string | null
    } | null
    createdAt: string
    startedAt: string | null
    completedAt: string | null
}

const statusColors: Record<string, string> = {
    REQUESTED: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
    PENDING: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    ASSIGNED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
    IN_PROGRESS: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200',
    ON_HOLD: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200',
    COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
    VERIFIED: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200',
    CLOSED: 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200',
    CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
    REJECTED: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200',
}

const statusLabels: Record<string, string> = {
    REQUESTED: 'Request',
    PENDING: 'Pending',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In Progress',
    ON_HOLD: 'On Hold',
    COMPLETED: 'Completed',
    VERIFIED: 'Verified',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled',
    REJECTED: 'Rejected',
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
    const { showToast } = useToast()
    const { hasPermission } = usePermission()
    
    // CRUD permissions
    const canCreate = hasPermission('list:create')
    const canDelete = hasPermission('list:delete')  // Hapus permanen
    
    // Workflow action permissions (terpisah dari CRUD)
    const canCancel = hasPermission('list:cancel')  // Batalkan WO
    const canVerify = hasPermission('list:verify')  // Verifikasi & Tolak WO
    const canSendReminder = hasPermission('workorders:reminder') // Kirim Reminder Manual
    const canApproveRequest = hasPermission('workorders:approve_request') || hasPermission('list:approve_request') // Approve/Reject WO Request

    const [loading, setLoading] = useState(false)
    const [initialLoading, setInitialLoading] = useState(true)
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [showFilters, setShowFilters] = useState(false)
    const [sites, setSites] = useState<{ id: string, name: string }[]>([])
    const [departments, setDepartments] = useState<{ id: string, name: string }[]>([])

    // Filters
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('') // PHASE 5: Debounced search value
    const [filterStatus, setFilterStatus] = useState('')
    const [filterPriority, setFilterPriority] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterSite, setFilterSite] = useState('')
    const [filterWoType, setFilterWoType] = useState('') // 'customer' | 'internal' | ''
    const [unassignedOnly, setUnassignedOnly] = useState(false)
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

    // PHASE 5: Debounce search input (300ms delay)
    useEffect(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(() => {
            setDebouncedSearch(search)
        }, 300)
        
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [search])

    // Approval states
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [processingApproval, setProcessingApproval] = useState(false)
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null)
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [cancelReason, setCancelReason] = useState('')
    const [sendingReminderId, setSendingReminderId] = useState<string | null>(null)
    
    // WO Request Approval states
    const [showApproveRequestModal, setShowApproveRequestModal] = useState(false)
    const [showRejectRequestModal, setShowRejectRequestModal] = useState(false)
    const [rejectRequestReason, setRejectRequestReason] = useState('')

    // Reminder Modal states
    const [showReminderModal, setShowReminderModal] = useState(false)
    const [selectedDepartmentId, setSelectedDepartmentId] = useState('')

    const fetchSites = async () => {
        try {
            const response = await fetch('/api/admin/sites?activeOnly=true')
            if (response.ok) {
                const data = await response.json()
                setSites(data.data || [])
            }
        } catch (error: unknown) {
            console.error('Error fetching sites:', error)
        }
    }

    const fetchDepartments = async () => {
        try {
            // Fetch only departments marked as reminder target
            const response = await fetch('/api/admin/departments?reminderOnly=true')
            if (response.ok) {
                const data = await response.json()
                setDepartments(data.data || data || [])
            }
        } catch (error: unknown) {
            console.error('Error fetching departments:', error)
        }
    }

    const fetchWorkOrders = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            })

            if (debouncedSearch) params.append('search', debouncedSearch) // Use debounced value
            if (filterStatus) params.append('status', filterStatus)
            if (filterPriority) params.append('priority', filterPriority)
            if (filterType) params.append('type', filterType)
            if (filterSite) params.append('siteId', filterSite)
            if (filterWoType) params.append('woType', filterWoType)
            if (unassignedOnly) params.append('unassignedOnly', 'true')

            const response = await fetch(`/api/admin/workorders?${params}`)

            if (response.ok) {
                const result = await response.json()
                const data = result.data || result // Fallback for raw JSON
                setWorkOrders(data.workOrders || [])
                setTotal(data.total || 0)
                setTotalPages(data.totalPages || 1)
            }
        } catch (error: unknown) {
            console.error('Error fetching work orders:', error)
        } finally {
            setLoading(false)
            setInitialLoading(false)
        }
    }, [page, debouncedSearch, filterStatus, filterPriority, filterType, filterSite, filterWoType, unassignedOnly])

    useEffect(() => {
        if (session?.user && status === 'authenticated') {
            fetchWorkOrders()
            fetchSites()
            fetchDepartments()
        }
    // PHASE 5: Use debouncedSearch instead of search for API calls
    }, [session, status, fetchWorkOrders])

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
        } catch (error: unknown) {
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
        } catch (error: unknown) {
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
        } catch (error: unknown) {
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
                showToast('success', 'Work Order berhasil dihapus permanen')
                fetchWorkOrders()
            } else {
                showToast('error', 'Gagal menghapus work order')
            }
        } catch (error: unknown) {
            console.error('Error deleting:', error)
            showToast('error', 'Terjadi kesalahan')
        } finally {
            setProcessingApproval(false)
        }
    }

    // Open reminder modal instead of sending directly
    const handleOpenReminderModal = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedWorkOrderId(id)
        setSelectedDepartmentId('')
        setShowReminderModal(true)
    }

    // Actually send reminder after department selection
    const handleSendReminder = async () => {
        if (!selectedWorkOrderId) return

        setSendingReminderId(selectedWorkOrderId)
        try {
            const response = await fetch(`/api/admin/workorders/${selectedWorkOrderId}/reminder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    departmentId: selectedDepartmentId || undefined 
                }),
            })
            const data = await response.json()
            
            if (response.ok) {
                showToast('success', data.message || 'Reminder terkirim')
                setShowReminderModal(false)
            } else {
                showToast('error', data.error || 'Gagal mengirim reminder')
            }
        } catch (error: unknown) {
            console.error('Error sending reminder:', error)
            showToast('error', 'Terjadi kesalahan')
        } finally {
            setSendingReminderId(null)
            setSelectedWorkOrderId(null)
        }
    }

    // Handler untuk Approve WO Request
    const handleApproveRequest = async () => {
        if (!selectedWorkOrderId) return
        
        setProcessingApproval(true)
        try {
            const response = await fetch(`/api/admin/workorders/${selectedWorkOrderId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'APPROVE' }),
            })
            const data = await response.json()
            
            if (response.ok) {
                showToast('success', 'WO Request berhasil disetujui')
                setShowApproveRequestModal(false)
                setSelectedWorkOrderId(null)
                fetchWorkOrders()
            } else {
                showToast('error', data.error || 'Gagal menyetujui request')
            }
        } catch (error: unknown) {
            console.error('Error approving request:', error)
            showToast('error', 'Terjadi kesalahan')
        } finally {
            setProcessingApproval(false)
        }
    }

    // Handler untuk Reject WO Request
    const handleRejectRequest = async () => {
        if (!selectedWorkOrderId || !rejectRequestReason.trim()) {
            showToast('error', 'Alasan penolakan wajib diisi')
            return
        }
        
        setProcessingApproval(true)
        try {
            const response = await fetch(`/api/admin/workorders/${selectedWorkOrderId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'REJECT', reason: rejectRequestReason.trim() }),
            })
            const data = await response.json()
            
            if (response.ok) {
                showToast('success', 'WO Request berhasil ditolak')
                setShowRejectRequestModal(false)
                setRejectRequestReason('')
                setSelectedWorkOrderId(null)
                fetchWorkOrders()
            } else {
                showToast('error', data.error || 'Gagal menolak request')
            }
        } catch (error: unknown) {
            console.error('Error rejecting request:', error)
            showToast('error', 'Terjadi kesalahan')
        } finally {
            setProcessingApproval(false)
        }
    }

    const clearFilters = () => {
        setFilterStatus('')
        setFilterPriority('')
        setFilterType('')
        setFilterSite('')
        setFilterWoType('')
        setUnassignedOnly(false)
        setSearch('')
    }

    const hasActiveFilters = filterStatus || filterPriority || filterType || filterWoType || unassignedOnly || search

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
            header: 'Customer / Dept',
            priority: 'secondary',
            render: (wo) => {
                // If pelanggan exists, show customer info
                if (wo.pelanggan) {
                    return (
                        <div>
                            <div className="text-sm text-gray-900 dark:text-white">{wo.pelanggan.nama}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{wo.pelanggan.idPelanggan}</div>
                        </div>
                    )
                }
                // If no pelanggan but has contactName with department name, show as Internal
                if (wo.contactName && wo.department) {
                    return (
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-900 dark:text-white">{wo.contactName}</span>
                                <span className="inline-flex px-1.5 py-0.5 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded">Internal</span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{wo.department.name}</div>
                        </div>
                    )
                }
                // Fallback
                return (
                    <div>
                        <div className="text-sm text-gray-900 dark:text-white">
                            {wo.contactName || <span className="text-gray-400">Guest</span>}
                        </div>
                    </div>
                )
            }
        },
        {
            key: 'site',
            header: 'Site',
            priority: 'secondary',
            render: (wo) => (
                <span className="text-sm text-gray-900 dark:text-white">
                    {wo.site ? wo.site.name : '-'}
                </span>
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
            key: 'createdAtDate',
            header: 'Tanggal Dibuat',
            priority: 'tertiary',
            render: (wo) => (
                <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {format(new Date(wo.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId })}
                </span>
            )
        },
        {
            key: 'duration',
            header: 'Durasi',
            priority: 'tertiary',
            render: (wo) => {
                if (!wo.completedAt || !wo.startedAt) return <span className="text-gray-400">-</span>;

                const duration = intervalToDuration({
                    start: new Date(wo.startedAt),
                    end: new Date(wo.completedAt)
                });

                return (
                    <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDuration(duration, {
                            format: ['days', 'hours', 'minutes'],
                            locale: localeId
                        }) || '< 1 mnt'}
                    </span>
                );
            }
        },
        {
            key: 'createdBy',
            header: 'Dibuat Oleh',
            priority: 'tertiary',
            render: (wo) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    {wo.createdBy?.name || '-'}
                </span>
            )
        }
    ]

    // Render actions for each row
    const renderActions = (wo: WorkOrder) => (
        <>
            {wo.status !== 'CANCELLED' && wo.status !== 'CLOSED' && wo.status !== 'COMPLETED' && (
                <>
                    {canCancel && (
                        <button
                            onClick={(e) => openCancelModal(wo.id, e)}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                            title="Batalkan"
                        >
                            <HiXCircle className="w-5 h-5" />
                        </button>
                    )}
                    {(wo.status === 'PENDING' || wo.status === 'ASSIGNED' || wo.status === 'IN_PROGRESS') && canSendReminder && (
                        <button
                            onClick={(e) => handleOpenReminderModal(wo.id, e)}
                            disabled={sendingReminderId === wo.id}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded disabled:opacity-50"
                            title="Kirim Reminder"
                        >
                            <HiBellAlert className={`w-5 h-5 ${sendingReminderId === wo.id ? 'animate-pulse text-sky-600' : ''}`} />
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={(e) => openDeleteModal(wo.id, e)}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Hapus Permanen"
                        >
                            <HiTrash className="w-5 h-5" />
                        </button>
                    )}
                </>
            )}
            {wo.status === 'COMPLETED' && (
                <>
                    {canVerify && (
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
                        </>
                    )}
                    {canDelete && (
                        <button
                            onClick={(e) => openDeleteModal(wo.id, e)}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Hapus Permanen"
                        >
                            <HiTrash className="w-5 h-5" />
                        </button>
                    )}
                </>
            )}
            {wo.status === 'CANCELLED' && canDelete && (
                <button
                    onClick={(e) => openDeleteModal(wo.id, e)}
                    className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Hapus Permanen"
                >
                    <HiTrash className="w-5 h-5" />
                </button>
            )}
            {wo.status === 'REQUESTED' && canApproveRequest && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); setSelectedWorkOrderId(wo.id); setShowRejectRequestModal(true); }}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Tolak Request"
                    >
                        <HiXCircle className="w-5 h-5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setSelectedWorkOrderId(wo.id); setShowApproveRequestModal(true); }}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Setujui Request"
                    >
                        <HiCheckCircle className="w-5 h-5" />
                    </button>
                </>
            )}
        </>
    )

    if (status === 'loading' || initialLoading) {
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
                    {canCreate && (
                        <Link
                            href="/admin/workorders/new"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                        >
                            <HiPlus className="w-5 h-5" />
                            <span>New Work Order</span>
                        </Link>
                    )}
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
                                <option value="REQUESTED">Request (Menunggu)</option>
                                <option value="PENDING">Pending</option>
                                <option value="ASSIGNED">Assigned</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="ON_HOLD">On Hold</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="VERIFIED">Verified</option>
                                <option value="CLOSED">Closed</option>
                                <option value="REJECTED">Rejected</option>
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

                        <div className="md:col-span-4 lg:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Site / Area</label>
                            <select
                                value={filterSite}
                                onChange={(e) => setFilterSite(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">Semua Site</option>
                                {sites.map((site) => (
                                    <option key={site.id} value={site.id}>{site.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Jenis WO Filter: Customer vs Internal */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jenis WO</label>
                            <select
                                value={filterWoType}
                                onChange={(e) => setFilterWoType(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:text-white"
                            >
                                <option value="">Semua</option>
                                <option value="customer">Customer</option>
                                <option value="internal">Internal (FOC)</option>
                            </select>
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
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Menampilkan {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} dari {total} work orders
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(page - 1)}
                            disabled={page === 1}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                        >
                            Sebelumnya
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            Hal {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed dark:text-gray-300"
                        >
                            Selanjutnya
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
            {/* Approve WO Request Modal */}
            {showApproveRequestModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mb-4">Setujui WO Request</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                Apakah Anda yakin ingin menyetujui request ini? Work Order akan berubah status menjadi <span className="font-semibold">PENDING</span> dan siap untuk di-assign ke teknisi.
                            </p>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowApproveRequestModal(false)
                                        setSelectedWorkOrderId(null)
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleApproveRequest}
                                    disabled={processingApproval}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {processingApproval ? 'Memproses...' : 'Ya, Setujui'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Reject WO Request Modal */}
            {showRejectRequestModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">Tolak WO Request</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Request akan ditolak dan pembuat request akan menerima notifikasi. Work Order akan berubah status menjadi <span className="font-semibold">REJECTED</span>.
                            </p>
                            <textarea
                                value={rejectRequestReason}
                                onChange={(e) => setRejectRequestReason(e.target.value)}
                                placeholder="Alasan penolakan (wajib diisi)..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px] dark:bg-gray-700 dark:text-white"
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowRejectRequestModal(false)
                                        setRejectRequestReason('')
                                        setSelectedWorkOrderId(null)
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleRejectRequest}
                                    disabled={processingApproval || !rejectRequestReason.trim()}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                                >
                                    {processingApproval ? 'Memproses...' : 'Tolak Request'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Reminder Modal with Department Selection */}
            {showReminderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-sky-600 dark:text-sky-400 mb-4 flex items-center gap-2">
                                <HiBellAlert className="w-5 h-5" />
                                Kirim Reminder
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Pilih department target untuk mengirim reminder push notification ke teknisi.
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Target Department
                                </label>
                                <select
                                    value={selectedDepartmentId}
                                    onChange={(e) => setSelectedDepartmentId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="">-- Semua Teknisi di Site --</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-400 mt-1">
                                    Kosongkan untuk kirim ke semua teknisi di site WO ini
                                </p>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowReminderModal(false)
                                        setSelectedDepartmentId('')
                                        setSelectedWorkOrderId(null)
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleSendReminder}
                                    disabled={sendingReminderId !== null}
                                    className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {sendingReminderId ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            Mengirim...
                                        </>
                                    ) : (
                                        <>
                                            <HiBellAlert className="w-4 h-4" />
                                            Kirim Reminder
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
