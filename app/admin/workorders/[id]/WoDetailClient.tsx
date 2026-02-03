"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import {
    HiArrowLeft,
    HiPencil,
    HiCheck,
    HiClock,
    HiUserCircle,
    HiCalendar,
    HiMapPin,
    HiPhoto,
    HiXMark,
    HiCheckCircle,
    HiChatBubbleLeft,
    HiChatBubbleLeftRight,
    HiPaperAirplane,
    HiLockClosed,
    HiCube,
    HiArrowUturnLeft,
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { ImageLightbox } from '@/components/ui/ImageLightbox'
import AddMaterialModal from '@/components/workorder/AddMaterialModal'
import { useSocket, useSocketEvent } from '@/lib/websocket/SocketContext'
import { SOCKET_EVENTS, type WorkOrderActivityPayload } from '@/lib/websocket/types'
import { usePermission } from '@/hooks/use-permission'

// Material Detail Types
interface MaterialDetailData {
    id: string
    type: 'keluar' | 'masuk'
    tanggal: string
    createdAt: string
    barang: { kode: string; nama: string; satuan: string }
    gudang: { kode: string; nama: string }
    jumlah: number
    kondisi: string
    keterangan: string | null
    user: { name: string | null; email: string } | null
    fotoBukti?: string[]
}

interface WorkOrderUpdateType {
    id: string
    updateType: string
    message: string
    createdAt: string
    user?: {
        id: string
        name?: string | null
        email?: string | null
    } | null
}

interface WorkOrderAttachment {
    id: string
    fileName: string
    filePath: string
    fileType: string
    fileSize: number
    caption: string | null
    uploadedAt: string
    user?: {
        id: string
        name?: string | null
        email?: string | null
    } | null
}

interface WorkOrderDetail {
    id: string
    workOrderNumber: string
    type: string
    title: string
    description: string
    status: string
    priority: string
    scheduledDate: string | null
    scheduledTimeStart: string | null
    scheduledTimeEnd: string | null
    locationAddress: string | null
    contactName: string | null
    contactPhone: string | null
    estimatedHours: number | null
    actualHours: number | null
    resolutionNotes: string | null
    createdAt: string
    startedAt: string | null
    completedAt: string | null
    pelanggan: {
        id: string
        idPelanggan: string
        nama: string
        email: string | null
        noTelp: string | null
    }
    ticket?: {
        ticketNumber: string
        subject: string
    } | null
    assignedTo?: {
        id: string
        name: string
    } | null
    department?: {
        name: string
    } | null
    tasks?: Array<{
        id: string
        title: string
        status: string
        order: number
    }>
    updates?: Array<WorkOrderUpdateType>
    attachments?: Array<WorkOrderAttachment>
    assignments?: Array<{
        id: string
        role: string
        user?: {
            id: string
            name: string
        }
    }>
    materials?: Array<{
        id: string
        quantity: number
        notes: string | null
        barang: {
            kode: string
            nama: string
            satuan: string
        }
    }>
    createdBy?: {
        id: string
        name: string | null
    } | null
}

type TimelineItem =
    | { type: 'comment'; date: Date; id: string; data: WorkOrderUpdateType }
    | { type: 'update'; date: Date; id: string; data: WorkOrderUpdateType }
    | { type: 'attachment'; date: Date; id: string; data: WorkOrderAttachment }

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

export function ClientComponent() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const params = useParams()
    const workOrderId = params?.id as string
    const { hasPermission } = usePermission()
    
    // CRUD permissions
    const canUpdate = hasPermission('list:update')  // Edit data (status, priority, etc)
    const canDelete = hasPermission('list:delete')  // Hapus permanen
    
    // Workflow action permissions (terpisah dari CRUD)
    const canCancel = hasPermission('list:cancel')  // Batalkan WO
    const canVerify = hasPermission('list:verify')  // Verifikasi & Tolak WO

    const [loading, setLoading] = useState(true)
    const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null)
    
    // ReadOnly logic based on admin approval/final state
    const isReadOnly = ['VERIFIED', 'CLOSED', 'CANCELLED'].includes(workOrder?.status || '')

    const [editMode, setEditMode] = useState<string | null>(null)
    const [editValues, setEditValues] = useState({
        status: '',
        priority: '',
        assignedToId: '',
    })
    const [newTask, setNewTask] = useState('')
    const [addingTask, setAddingTask] = useState(false)
    const [newComment, setNewComment] = useState('')
    const [addingComment, setAddingComment] = useState(false)
    const [showRejectModal, setShowRejectModal] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [cancelReason, setCancelReason] = useState('')
    const [processingApproval, setProcessingApproval] = useState(false)
    // TAB STATE MUST BE HERE (Before any return statements)
    const [activeTab, setActiveTab] = useState<'activity' | 'discussion' | 'materials'>(() => {
        return ['COMPLETED', 'CANCELLED', 'VERIFIED'].includes(workOrder?.status || '') ? 'activity' : 'discussion';
    });
    
    // File Upload State
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    
    // ImageLightbox State for completion photos
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)
    
    // ImageLightbox State for discussion photos
    const [discussionLightboxOpen, setDiscussionLightboxOpen] = useState(false)
    const [discussionLightboxIndex, setDiscussionLightboxIndex] = useState(0)

    // Material Detail Modal State
    const [materialDetailOpen, setMaterialDetailOpen] = useState(false)
    const [materialDetailData, setMaterialDetailData] = useState<MaterialDetailData | null>(null)
    const [loadingMaterialDetail, setLoadingMaterialDetail] = useState(false)
    const [addMaterialModalOpen, setAddMaterialModalOpen] = useState(false)

    const fetchWorkOrder = useCallback(async () => {
        try {
            const response = await fetch(`/api/admin/workorders/${workOrderId}`)
            if (response.ok) {
                const result = await response.json()
                console.log('[WorkOrder] Fetched w/ attachments:', result.data.attachments?.length)
                setWorkOrder(result.data)
                setEditValues({
                    status: result.data.status,
                    priority: result.data.priority,
                    assignedToId: result.data.assignedTo?.id || '',
                })
            } else if (response.status === 404) {
                alert('Work order not found')
                router.push('/admin/workorders/list')
            }
        } catch (error: unknown) {
            const axiosError = error as { response?: { data?: { error?: string } } }
            console.error('Error fetching work order:', error)
            alert('An error occurred while fetching the work order: ' + (axiosError.response?.data?.error || 'Unknown error'))
        } finally {
            setLoading(false)
        }
    }, [workOrderId, router])

    // Fetch material detail by updateId (MATERIAL_PICKUP/MATERIAL_RETURN)
    const fetchMaterialDetail = async (updateId: string, updateType: string) => {
        setLoadingMaterialDetail(true)
        setMaterialDetailOpen(true)
        try {
            const res = await fetch(`/api/admin/workorders/${workOrderId}/material-detail?updateId=${updateId}`)
            if (res.ok) {
                const result = await res.json()
                setMaterialDetailData({
                    ...result.data,
                    type: updateType === 'MATERIAL_PICKUP' ? 'keluar' : 'masuk'
                })
            } else {
                console.error('Failed to fetch material detail')
            }
        } catch (error) {
            console.error('Error fetching material detail:', error)
        } finally {
            setLoadingMaterialDetail(false)
        }
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file')
            return
        }

        setIsUploading(true)
        try {
            // 1. Upload to server
            const formData = new FormData()
            formData.append('file', file)
            formData.append('type', 'work-order-updates')
            formData.append('workOrderId', workOrderId)

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            if (!uploadRes.ok) throw new Error('Failed to upload image')
            const { url, fileName } = await uploadRes.json()

            // 2. Attach to Work Order
            const attachRes = await fetch(`/api/admin/workorders/${workOrderId}/attachments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: fileName || file.name,
                    filePath: url,
                    fileType: file.type,
                    fileSize: file.size,
                    caption: '' 
                }),
            })

            if (!attachRes.ok) throw new Error('Failed to attach image to work order')
            
            // Refresh
            fetchWorkOrder()
            
        } catch (error) {
            console.error('Upload failed:', error)
            alert('Failed to upload image')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    // WebSocket for real-time Activity Timeline
    const { socket, isConnected } = useSocket()

    // Join/leave workorder room for real-time updates
    useEffect(() => {
        if (!socket || !isConnected || !workOrderId) return

        console.log(`[WorkOrder] Joining room workorder:${workOrderId}`)
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { room: `workorder:${workOrderId}` })

        return () => {
            console.log(`[WorkOrder] Leaving room workorder:${workOrderId}`)
            socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { room: `workorder:${workOrderId}` })
        }
    }, [socket, isConnected, workOrderId])

    // Handle real-time activity updates
    const handleNewActivity = useCallback(
        (payload: WorkOrderActivityPayload) => {
            if (payload.workOrderId !== workOrderId) return

            console.log('[WorkOrder] New activity received:', payload.activity.type)

            // Refresh data to get the new activity
            fetchWorkOrder()
        },
        [workOrderId, fetchWorkOrder]
    )

    // Subscribe to WebSocket activity events
    useSocketEvent(SOCKET_EVENTS.WORKORDER_ACTIVITY, handleNewActivity)

    // Handle real-time Work Order updates (e.g. status change, tasks)
    const handleWOUpdate = useCallback(
        (payload: { id?: string; workOrderId?: string }) => {
            // Check if payload is the WO object itself or has ID
            const updatedId = payload.id || payload.workOrderId
            if (updatedId === workOrderId) {
                console.log('[WorkOrder] Update received, refreshing...')
                fetchWorkOrder()
            }
        },
        [workOrderId, fetchWorkOrder]
    )
    useSocketEvent(SOCKET_EVENTS.WORKORDER_UPDATE, handleWOUpdate)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }

        if (session?.user && status === 'authenticated') {
            fetchWorkOrder()
        }
    }, [session, status, router, workOrderId, fetchWorkOrder])

    const handleUpdateField = async (field: string) => {
        try {
            const response = await fetch(`/api/admin/workorders/${workOrderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    [field]: editValues[field as keyof typeof editValues] || null
                }),
            })

            if (response.ok) {
                setEditMode(null)
                fetchWorkOrder()
            } else {
                const error = await response.json()
                alert(`Error: ${error.error || 'Failed to update'}`)
            }
        } catch (error) {
            console.error('Error updating:', error)
            alert('An error occurred')
        }
    }

    const [showVerifyModal, setShowVerifyModal] = useState(false)

    // Original handleVerify logic moved here
    const processVerify = async () => {
        setProcessingApproval(true)
        try {
            const response = await fetch(`/api/admin/workorders/${workOrderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'VERIFIED' }),
            })

            if (response.ok) {
                setShowVerifyModal(false)
                fetchWorkOrder()
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

    // New handler just opens the modal
    const handleVerify = async () => {
        setShowVerifyModal(true)
    }

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            alert('Please provide a rejection reason')
            return
        }

        setProcessingApproval(true)
        try {
            const response = await fetch(`/api/admin/workorders/${workOrderId}`, {
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
                fetchWorkOrder()
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

    const handleCancel = async () => {
        if (!cancelReason.trim()) {
            alert('Please provide a cancellation reason')
            return
        }

        setProcessingApproval(true)
        try {
            const response = await fetch(`/api/admin/workorders/${workOrderId}?reason=${encodeURIComponent(cancelReason)}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                setShowCancelModal(false)
                setCancelReason('')
                fetchWorkOrder()
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

    const handleDelete = async () => {
        if (!confirm('Apakah anda yakin ingin menghapus Work Order ini secara PERMANEN? Data yang dihapus tidak dapat dikembalikan.')) {
            return
        }

        setProcessingApproval(true)
        try {
            const response = await fetch(`/api/admin/workorders/${workOrderId}?permanent=true`, {
                method: 'DELETE',
            })

            if (response.ok) {
                alert('Work Order berhasil dihapus permanen')
                router.push('/admin/workorders/list')
            } else {
                alert('Gagal menghapus work order')
            }
        } catch (error) {
            console.error('Error deleting:', error)
            alert('Terjadi kesalahan')
        } finally {
            setProcessingApproval(false)
        }
    }

    const handleAddTask = async () => {
        if (!newTask.trim()) return

        setAddingTask(true)
        try {
            const response = await fetch(`/api/admin/workorders/${workOrderId}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTask }),
            })

            if (response.ok) {
                setNewTask('')
                fetchWorkOrder()
            }
        } catch (error) {
            console.error('Error adding task:', error)
        } finally {
            setAddingTask(false)
        }
    }

    if (status === 'loading' || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <PageLoader />
            </div>
        )
    }

    if (!workOrder) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Work order not found</div>
            </div>
        )
    }

    const handleAddComment = async () => {
        if (!newComment.trim()) return

        setAddingComment(true)
        try {
            const response = await fetch(`/api/admin/workorders/${workOrderId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: newComment }),
            })

            if (response.ok) {
                setNewComment('')
                fetchWorkOrder()
            } else {
                alert('Failed to add comment')
            }
        } catch (error) {
            console.error('Error adding comment:', error)
            alert('Error adding comment')
        } finally {
            setAddingComment(false)
        }
    }

    const completedTasks = workOrder.tasks?.filter(t => t.status === 'COMPLETED').length || 0
    const totalTasks = workOrder.tasks?.length || 0
    const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

    // Process timeline items
    const timelineItems: TimelineItem[] = [
        ...(workOrder.updates || []).map(u => ({
            type: (u.updateType === 'COMMENT' ? 'comment' : 'update') as 'comment' | 'update',
            date: new Date(u.createdAt),
            id: u.id,
            data: u
        })),
        ...(workOrder.attachments || [])
            .filter(a => !a.caption?.startsWith('[COMPLETION]'))
            .map(a => ({
                type: 'attachment' as const,
                date: new Date(a.uploadedAt),
                id: a.id,
                data: a
            }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime())

    // Filter completion photos
    const completionAttachments = workOrder.attachments?.filter(a => a.caption?.startsWith('[COMPLETION]')) || []

    // 1. TIMELINE LOGS: Status changes, Assignments, Notes, AND Photos (except comments)
    const timelineLogItems = timelineItems.filter(item => {
        if (item.type === 'comment') return false // Exclude comments
        return true
    })

    // 2. DISCUSSION: Comments AND Photos
    const discussionItems = timelineItems.filter(item => {
        if (item.type === 'comment') return true
        if (item.type === 'attachment') return true // Photos appear in both
        return false
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/workorders/list"
                    className="p-2 hover:bg-gray-100 rounded-lg"
                >
                    <HiArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">{workOrder.workOrderNumber}</h1>
                    <p className="text-gray-600 mt-1">{workOrder.title}</p>
                </div>
                {canCancel && workOrder.status !== 'CANCELLED' && workOrder.status !== 'CLOSED' && workOrder.status !== 'COMPLETED' && (
                    <button
                        onClick={() => setShowCancelModal(true)}
                        disabled={processingApproval}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                        <HiXMark className="w-5 h-5" />
                        Batalkan
                    </button>
                )}
                {canDelete && (
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        disabled={processingApproval}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                        <HiXMark className="w-5 h-5" />
                        Hapus
                    </button>
                )}
                {canVerify && workOrder.status === 'COMPLETED' && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowRejectModal(true)}
                            disabled={processingApproval}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                            <HiXMark className="w-5 h-5" />
                            Tolak
                        </button>
                        <button
                            onClick={handleVerify}
                            disabled={processingApproval}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
                        >
                            <HiCheckCircle className="w-5 h-5" />
                            Verifikasi
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Work Order Info */}
                    {/* Work Order Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {editMode === 'status' ? (
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={editValues.status}
                                            onChange={(e) => setEditValues({ ...editValues, status: e.target.value })}
                                            className="px-3 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        >
                                            <option value="PENDING">Pending</option>
                                            <option value="ASSIGNED">Assigned</option>
                                            <option value="IN_PROGRESS">In Progress</option>
                                            <option value="ON_HOLD">On Hold</option>
                                            <option value="COMPLETED">Completed</option>
                                            <option value="VERIFIED">Verified</option>
                                            <option value="CLOSED">Closed</option>
                                        </select>
                                        <button
                                            onClick={() => handleUpdateField('status')}
                                            className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                                        >
                                            <HiCheck className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[workOrder.status]}`}>
                                            {workOrder.status.replace('_', ' ')}
                                        </span>
                                        {!isReadOnly && canUpdate && (
                                            <button
                                                onClick={() => setEditMode('status')}
                                                className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400"
                                            >
                                                <HiPencil className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {editMode === 'priority' ? (
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={editValues.priority}
                                            onChange={(e) => setEditValues({ ...editValues, priority: e.target.value })}
                                            className="px-3 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="NORMAL">Normal</option>
                                            <option value="HIGH">High</option>
                                            <option value="URGENT">Urgent</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                        <button
                                            onClick={() => handleUpdateField('priority')}
                                            className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                                        >
                                            <HiCheck className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1">
                                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                                            {workOrder.priority}
                                        </span>
                                        {!isReadOnly && canUpdate && (
                                            <button
                                                onClick={() => setEditMode('priority')}
                                                className="p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-400"
                                            >
                                                <HiPencil className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Type:</span>{' '}
                                <span className="font-medium text-gray-900 dark:text-gray-200">{workOrder.type}</span>
                            </div>
                            <div>
                                <span className="text-gray-600 dark:text-gray-400">Description:</span>
                                <p className="mt-1 text-gray-900 dark:text-gray-200">{workOrder.description}</p>
                            </div>
                            {workOrder.ticket && (
                                <div>
                                    <span className="text-gray-600 dark:text-gray-400">Related Ticket:</span>{' '}
                                    <Link
                                        href={`/admin/helpdesk/tiket/${workOrder.ticket.ticketNumber.split('-').pop()}`}
                                        className="text-sky-600 dark:text-sky-400 hover:underline"
                                    >
                                        {workOrder.ticket.ticketNumber}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tasks Checklist */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Tasks Checklist</h3>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {completedTasks}/{totalTasks} completed
                            </span>
                        </div>

                        {totalTasks > 0 && (
                            <div className="mb-4">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                        className="bg-sky-600 h-2 rounded-full transition-all"
                                        style={{ width: `${progressPercent}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 mb-4">
                            {workOrder.tasks?.map((task) => (
                                <div key={task.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                                    <input
                                        type="checkbox"
                                        checked={task.status === 'COMPLETED'}
                                        readOnly
                                        className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-sky-600"
                                    />
                                    <span className={task.status === 'COMPLETED' ? 'line-through text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-200'}>
                                        {task.title}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {!isReadOnly && (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newTask}
                                    onChange={(e) => setNewTask(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                                    placeholder="Add new task..."
                                    className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                                    disabled={addingTask}
                                />
                                <button
                                    onClick={handleAddTask}
                                    disabled={addingTask || !newTask.trim()}
                                    className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 disabled:opacity-50"
                                >
                                    Add
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Activity & Discussion Tabs */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                            {/* Tab Headers */}
                            <div className="p-4 pb-0">
                                <div className="flex p-1 space-x-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
                                    <button
                                        onClick={() => setActiveTab('activity')}
                                        className={`w-full py-2.5 text-sm font-medium leading-5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
                                            activeTab === 'activity'
                                                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        <HiClock className="w-5 h-5" />
                                        Activity Timeline
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('discussion')}
                                        className={`w-full py-2.5 text-sm font-medium leading-5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
                                            activeTab === 'discussion'
                                                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        <HiChatBubbleLeftRight className="w-5 h-5" />
                                        Diskusi
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('materials')}
                                        className={`w-full py-2.5 text-sm font-medium leading-5 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
                                            activeTab === 'materials'
                                                ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        <HiCube className="w-5 h-5" />
                                        Material Used
                                    </button>
                                </div>
                            </div>

                        {/* Hidden File Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />

                        <div className="p-6">
                            {/* Tab Content: ACTIVITY TIMELINE */}
                            {activeTab === 'activity' && (
                                <div className="space-y-6">
                                    {/* Timeline Items (Log System) */}
                                    <div className="space-y-4">
                                        {timelineLogItems.length > 0 ? (
                                            timelineLogItems.map((item) => {
                                                const attData = item.data as WorkOrderAttachment;
                                                const updateData = item.data as WorkOrderUpdateType;
                                                const isUpdate = item.type === 'update';

                                                // Display Name Logic
                                                const user = isUpdate ? updateData.user : attData.user;
                                                const userName = user?.name || user?.email || 'Unknown User';

                                                return (
                                                <div key={item.id} className="flex gap-4">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                                        updateData?.updateType === 'MATERIAL_PICKUP' ? 'bg-orange-100 dark:bg-orange-900/30'
                                                        : updateData?.updateType === 'MATERIAL_RETURN' ? 'bg-green-100 dark:bg-green-900/30'
                                                        : updateData?.updateType === 'STATUS_CHANGE' ? 'bg-blue-100 dark:bg-blue-900/30'
                                                        : item.type === 'update' ? 'bg-sky-100 dark:bg-sky-900/30' 
                                                        : 'bg-orange-100 dark:bg-orange-900/30'
                                                        }`}>
                                                        {updateData?.updateType === 'MATERIAL_PICKUP' ? (
                                                            <HiCube className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                                        ) : updateData?.updateType === 'MATERIAL_RETURN' ? (
                                                            <HiArrowUturnLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                        ) : item.type === 'update' ? (
                                                            <HiClock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                                                        ) : (
                                                            <HiPhoto className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        {item.type === 'update' ? (
                                                            <div className="">
                                                                {/* Label berdasarkan updateType */}
                                                                {updateData.updateType === 'MATERIAL_PICKUP' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => fetchMaterialDetail(updateData.id, updateData.updateType)}
                                                                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded mb-1 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors cursor-pointer"
                                                                    >
                                                                        📦 Ambil Barang
                                                                    </button>
                                                                )}
                                                                {updateData.updateType === 'MATERIAL_RETURN' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => fetchMaterialDetail(updateData.id, updateData.updateType)}
                                                                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded mb-1 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors cursor-pointer"
                                                                    >
                                                                        ↩️ Kembalikan Barang
                                                                    </button>
                                                                )}
                                                                {updateData.updateType === 'STATUS_CHANGE' && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded mb-1">
                                                                        🔄 Perubahan Status
                                                                    </span>
                                                                )}
                                                                <p className={`text-sm text-gray-900 dark:text-gray-200 whitespace-pre-wrap ${
                                                                    (updateData.updateType === 'MATERIAL_PICKUP' || updateData.updateType === 'MATERIAL_RETURN') 
                                                                        ? 'cursor-pointer hover:text-gray-700 dark:hover:text-white' : ''
                                                                }`}
                                                                    onClick={() => {
                                                                        if (updateData.updateType === 'MATERIAL_PICKUP' || updateData.updateType === 'MATERIAL_RETURN') {
                                                                            fetchMaterialDetail(updateData.id, updateData.updateType)
                                                                        }
                                                                    }}
                                                                >{updateData.message}</p>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600 mb-1 inline-block">
                                                                <a
                                                                    href={attData.filePath}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="block"
                                                                >
                                                                    <img
                                                                        src={attData.filePath}
                                                                        alt={attData.caption || 'Attachment'}
                                                                        className="h-40 rounded-lg object-cover mb-2"
                                                                    />
                                                                </a>
                                                                {attData.caption && (
                                                                    <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                                                        {attData.caption.replace(/^\[(HOLD|NOTE)\]\s*/, '')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            {item.type === 'update' ? (
                                                                <>
                                                                    {userName} · {format(item.date, 'dd MMM yyyy HH:mm', { locale: localeId })}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {userName} · {format(item.date, 'dd MMM yyyy HH:mm', { locale: localeId })}
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            )})
                                        ) : (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Belum ada aktivitas sistem.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Tab Content: DISCUSSION */}
                            {/* Tab Content: MATERIALS */}
                            {activeTab === 'materials' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Material & Sparepart</h3>
                                        {!isReadOnly && (
                                            <button
                                                onClick={() => setAddMaterialModalOpen(true)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
                                            >
                                                <HiCube className="w-4 h-4" />
                                                Tambah Material
                                            </button>
                                        )}
                                    </div>

                                    {workOrder.materials && workOrder.materials.length > 0 ? (
                                        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-100 dark:bg-gray-800">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Barang</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jumlah</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Catatan</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                                    {workOrder.materials.map((item) => (
                                                        <tr key={item.id}>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center">
                                                                    <div>
                                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                                            {item.barang.nama}
                                                                        </div>
                                                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                                                            {item.barang.kode}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    {item.quantity} {item.barang.satuan}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                                    {item.notes || '-'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                                            <HiCube className="mx-auto h-12 w-12 text-gray-400" />
                                            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Belum ada material</h3>
                                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                                Gunakan tombol "Tambah Material" untuk mencatat penggunaan barang.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab Content: DISCUSSION */}
                            {activeTab === 'discussion' && (
                                <div className="flex flex-col h-[600px] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                                    {/* Discussion Items (Chat Stream) */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-gray-50/50 dark:bg-gray-900/50">
                                        {discussionItems.length > 0 ? (
                                            discussionItems
                                                .sort((a,b) => a.date.getTime() - b.date.getTime())
                                                .map((item, index) => {
                                                const attData = item.data as WorkOrderAttachment;
                                                const updateData = item.data as WorkOrderUpdateType;
                                                const isComment = item.type === 'comment';
                                                
                                                // Try to identify if "Me"
                                                const creatorId = isComment ? updateData.user?.id : attData.user?.id; 
                                                const currentUserId = (session?.user as { id?: string })?.id;
                                                const isMe = creatorId && currentUserId ? creatorId === currentUserId : false;

                                                // Name display
                                                const user = isComment ? updateData.user : attData.user;
                                                const creatorName = user?.name || user?.email || 'Unknown';
                                                
                                                // Check if previous message was from same user (to group avatars)
                                                const prevItem = index > 0 ? discussionItems[index - 1] : null;
                                                const prevCreatorId = prevItem
                                                    ? (prevItem.type === 'comment' ? (prevItem.data as WorkOrderUpdateType).user?.id : (prevItem.data as WorkOrderAttachment).user?.id)
                                                    : null;
                                                const isSequence = prevCreatorId === creatorId;

                                                return (
                                                    <div key={item.id} className={`flex w-full gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                        {/* Avatar for Others (only if not sequence or always show for clarity) */}
                                                        {!isMe && (
                                                            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                                                                isSequence ? 'invisible' : 'bg-linear-to-br from-indigo-500 to-purple-500'
                                                            }`}>
                                                                {creatorName.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}

                                                        <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                                            {/* Sender Name (only if not sequence) */}
                                                            {!isMe && !isSequence && (
                                                                <span className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 ml-1 font-medium">
                                                                    {creatorName}
                                                                </span>
                                                            )}
                                                            
                                                            {/* Bubble */}
                                                            <div className={`relative px-4 py-2.5 shadow-sm ${
                                                                isMe 
                                                                    ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                                                                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-sm'
                                                            }`}>
                                                                {isComment ? (
                                                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                                                        {updateData.message}
                                                                    </p>
                                                                ) : (
                                                                    <div className="-mx-2 -mt-2">
                                                                         <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                // Find index of this attachment in discussionItems attachments
                                                                                const attachmentItems = discussionItems.filter(i => i.type === 'attachment')
                                                                                const attachmentIndex = attachmentItems.findIndex(i => i.id === item.id)
                                                                                setDiscussionLightboxIndex(attachmentIndex >= 0 ? attachmentIndex : 0)
                                                                                setDiscussionLightboxOpen(true)
                                                                            }}
                                                                            className="block w-full cursor-pointer"
                                                                        >
                                                                            <img
                                                                                src={attData.filePath}
                                                                                alt={attData.caption || 'Attachment'}
                                                                                className={`rounded-lg object-cover max-h-60 min-w-[200px] w-full hover:opacity-90 transition-opacity ${isMe ? 'bg-indigo-500' : 'bg-gray-100'}`}
                                                                            />
                                                                        </button>
                                                                        {attData.caption && (
                                                                            <p className="text-sm mt-2 px-2 pb-1 opacity-90">
                                                                                {attData.caption}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Timestamp */}
                                                                <div className={`text-[10px] mt-1 text-right flex justify-end gap-1 ${
                                                                    isMe ? 'text-indigo-100/80' : 'text-gray-400'
                                                                }`}>
                                                                    {format(item.date, 'HH:mm')}
                                                                    {isMe && <HiCheckCircle className="w-3 h-3" />}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 mb-4">
                                                    <HiChatBubbleLeft className="w-8 h-8 text-indigo-400" />
                                                </div>
                                                <p className="text-gray-500 dark:text-gray-400 font-medium">Belum ada diskusi</p>
                                                <p className="text-sm text-gray-400 mt-1">Mulai percakapan dengan tim Anda disini</p>
                                            </div>
                                        )}
                                        <div ref={messagesEndRef} />
                                    </div>

                                    {/* Chat Input Bar */}
                                    {['COMPLETED', 'CANCELLED', 'VERIFIED'].includes(workOrder.status) ? (
                                        <div className="bg-gray-50 dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700 text-center">
                                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium flex items-center justify-center gap-2">
                                                <HiLockClosed className="w-4 h-4" />
                                                Diskusi ditutup (Status: {workOrder.status})
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-gray-800 p-4 border-t border-gray-200 dark:border-gray-700">
                                            <div className="flex items-end gap-3 max-w-4xl mx-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    disabled={isUploading}
                                                    className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-all shrink-0"
                                                    title="Upload Foto"
                                                >
                                                    <HiPhoto className="w-7 h-7" />
                                                </button>
                                                
                                                <div className="flex-1 bg-white dark:bg-gray-800 rounded-3xl border border-gray-300 dark:border-gray-600 focus-within:border-gray-400 dark:focus-within:border-gray-500 focus-within:shadow-sm overflow-hidden transition-all duration-200">
                                                    <textarea
                                                        value={newComment}
                                                        onChange={(e) => setNewComment(e.target.value)}
                                                        placeholder="Ketik pesan..."
                                                        className="w-full px-5 py-3 border-none! ring-0! outline-none! bg-transparent text-sm min-h-[48px] max-h-[140px] resize-none text-gray-700 dark:text-gray-200 leading-normal"
                                                        style={{ height: 'auto' }}
                                                        onInput={(e) => {
                                                            const target = e.target as HTMLTextAreaElement;
                                                            target.style.height = 'auto';
                                                            target.style.height = `${target.scrollHeight}px`;
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                handleAddComment();
                                                            }
                                                        }}
                                                    />
                                                </div>

                                                <button
                                                    onClick={handleAddComment}
                                                    disabled={addingComment || !newComment.trim()}
                                                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-all shrink-0 shadow-sm ${
                                                        !newComment.trim() 
                                                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500' 
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-indigo-200 dark:shadow-none'
                                                    }`}
                                                    title="Kirim Pesan"
                                                >
                                                    <HiPaperAirplane className={`w-6 h-6 -rotate-90 ${newComment.trim() ? 'translate-x-0.5' : ''}`} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* ImageLightbox for Discussion Photos */}
                            <ImageLightbox
                                images={discussionItems
                                    .filter(i => i.type === 'attachment')
                                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                                    .map(i => (i.data as WorkOrderAttachment).filePath)}
                                initialIndex={discussionLightboxIndex}
                                isOpen={discussionLightboxOpen}
                                onClose={() => setDiscussionLightboxOpen(false)}
                                alt="Foto Diskusi"
                            />
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Customer Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <HiUserCircle className="w-5 h-5" />
                            Customer Info
                            {!workOrder.pelanggan && (
                                <span className="text-xs font-normal bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">Guest</span>
                            )}
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-gray-600 dark:text-gray-400">Name</p>
                                <p className="font-medium text-gray-900 dark:text-white">{workOrder.pelanggan?.nama || workOrder.contactName || '-'}</p>
                            </div>
                            {workOrder.pelanggan?.idPelanggan && (
                                <div>
                                    <p className="text-gray-600 dark:text-gray-400">ID</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{workOrder.pelanggan.idPelanggan}</p>
                                </div>
                            )}
                            {(workOrder.pelanggan?.email) && (
                                <div>
                                    <p className="text-gray-600 dark:text-gray-400">Email</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{workOrder.pelanggan.email}</p>
                                </div>
                            )}
                            {(workOrder.pelanggan?.noTelp || workOrder.contactPhone) && (
                                <div>
                                    <p className="text-gray-600 dark:text-gray-400">Phone</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{workOrder.pelanggan?.noTelp || workOrder.contactPhone}</p>
                                </div>
                            )}
                            {workOrder.locationAddress && (
                                <div>
                                    <p className="text-gray-600 dark:text-gray-400">Address</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{workOrder.locationAddress}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Completion Report - Only Show if Completed */}
                    {(workOrder.status === 'COMPLETED' || workOrder.status === 'VERIFIED' || workOrder.status === 'CLOSED') && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-emerald-500">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <HiCheckCircle className="w-5 h-5 text-emerald-600" />
                                Laporan Penyelesaian
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan Penyelesaian</h4>
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-sm text-gray-800 dark:text-emerald-100">
                                        {workOrder.resolutionNotes || <span className="text-gray-400 italic">Tidak ada catatan</span>}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Foto Dokumentasi ({completionAttachments.length})</h4>
                                    {completionAttachments.length > 0 ? (
                                        <>
                                            <div className="grid grid-cols-2 gap-2">
                                                {completionAttachments.map((att, index) => (
                                                    <button
                                                        key={att.id}
                                                        onClick={() => {
                                                            setLightboxIndex(index)
                                                            setLightboxOpen(true)
                                                        }}
                                                        className="block group relative aspect-square cursor-pointer"
                                                    >
                                                        <img
                                                            src={att.filePath}
                                                            alt="Bukti Selesai"
                                                            className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700 group-hover:border-emerald-500 transition-colors"
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center">
                                                            <HiPhoto className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                            <ImageLightbox
                                                images={completionAttachments.map(att => att.filePath)}
                                                initialIndex={lightboxIndex}
                                                isOpen={lightboxOpen}
                                                onClose={() => setLightboxOpen(false)}
                                                alt="Foto Dokumentasi"
                                            />
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">Tidak ada foto dokumentasi</p>
                                    )}
                                </div>

                                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <span>Diselesaikan oleh: {workOrder.assignedTo?.name}</span>
                                    <span>{workOrder.completedAt ? format(new Date(workOrder.completedAt), 'dd MMM HH:mm', { locale: localeId }) : '-'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Assignment */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Assignment</h3>
                        {workOrder.assignedTo ? (
                            <div className="text-sm">
                                <p className="text-gray-600 dark:text-gray-400">Assigned to:</p>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {workOrder.assignedTo.name}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">Not assigned yet</p>
                        )}
                        {workOrder.department && (
                            <div className="text-sm mt-3">
                                <p className="text-gray-600 dark:text-gray-400">Department:</p>
                                <p className="font-medium text-gray-900 dark:text-white">{workOrder.department.name}</p>
                            </div>
                        )}
                        {workOrder.assignments && workOrder.assignments.filter((a: { role: string }) => a.role === 'PARTNER').length > 0 && (
                            <div className="text-sm mt-3">
                                <p className="text-gray-600 dark:text-gray-400">Partner:</p>
                                <div className="space-y-1 mt-1">
                                    {workOrder.assignments
                                        .filter((a: { role: string }) => a.role === 'PARTNER')
                                        .map((a: { id: string; role: string; user?: { name?: string; firstName?: string; lastName?: string } }) => (
                                            <p key={a.id} className="font-medium text-gray-900 dark:text-white">{a.user?.name || a.user?.firstName + ' ' + a.user?.lastName}</p>
                                        ))}
                                </div>
                            </div>
                        )}
                        {workOrder.createdBy && (
                            <div className="text-sm mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-gray-600 dark:text-gray-400">Dibuat oleh:</p>
                                <p className="font-medium text-gray-900 dark:text-white">{workOrder.createdBy.name || '-'}</p>
                            </div>
                        )}
                    </div>

                    {/* Schedule */}
                    {workOrder.scheduledDate && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <HiCalendar className="w-5 h-5" />
                                Schedule
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <p className="text-gray-600 dark:text-gray-400">Date</p>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {format(new Date(workOrder.scheduledDate), 'dd MMM yyyy', { locale: localeId })}
                                    </p>
                                </div>
                                {workOrder.scheduledTimeStart && (
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Time</p>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {workOrder.scheduledTimeStart}
                                            {workOrder.scheduledTimeEnd && ` - ${workOrder.scheduledTimeEnd}`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Location */}
                    {workOrder.locationAddress && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <HiMapPin className="w-5 h-5" />
                                Location
                            </h3>
                            <p className="text-sm text-gray-900 dark:text-white">{workOrder.locationAddress}</p>
                            {workOrder.contactName && (
                                <div className="mt-3 text-sm">
                                    <p className="text-gray-600 dark:text-gray-400">Contact</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{workOrder.contactName}</p>
                                    {workOrder.contactPhone && (
                                        <p className="text-gray-600 dark:text-gray-400">{workOrder.contactPhone}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}


                </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tolak Hasil Pekerjaan</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Work order akan dikembalikan ke status In Progress. Silakan berikan alasan penolakan untuk petugas.
                            </p>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Alasan penolakan (wajib diisi)..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px] dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false)
                                        setRejectReason('')
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Batalkan Work Order</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Tindakan ini tidak dapat dibatalkan. Work order akan ditandai sebagai Cancelled.
                            </p>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Alasan pembatalan (wajib diisi)..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px] dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowCancelModal(false)
                                        setCancelReason('')
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
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

            {/* Verify Confirm Modal */}
            {showVerifyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                    <HiCheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Verifikasi Work Order</h3>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                                Apakah Anda yakin ingin memverifikasi work order ini?
                                <br />
                                <span className="font-medium text-gray-900 dark:text-white">Status akan berubah menjadi VERIFIED dan stok barang akan terpotong secara permanen.</span>
                            </p>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowVerifyModal(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                                    disabled={processingApproval}
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={processVerify}
                                    disabled={processingApproval}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-medium transition-colors flex items-center gap-2"
                                >
                                    {processingApproval ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Memproses...
                                        </>
                                    ) : (
                                        'Ya, Verifikasi'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                        <h3 className="text-lg font-bold mb-4 text-red-600 dark:text-red-400">Hapus Permanen Work Order?</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Tindakan ini tidak dapat dibatalkan. Work Order beserta seluruh data terkait (tasks, history, lampiran) akan dihapus permanen dari database.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={processingApproval}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
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
            )}

            {/* Add Material Modal */}
            <AddMaterialModal
                isOpen={addMaterialModalOpen}
                onClose={() => setAddMaterialModalOpen(false)}
                onSuccess={() => fetchWorkOrder()}
                workOrderId={workOrderId}
            />

            {/* Material Detail Modal */}
            <Modal
                isOpen={materialDetailOpen}
                onClose={() => {
                    setMaterialDetailOpen(false)
                    setMaterialDetailData(null)
                }}
                title={materialDetailData?.type === 'keluar' ? 'Detail Barang Keluar' : 'Detail Barang Masuk'}
                size="lg"
            >
                {loadingMaterialDetail ? (
                    <div className="p-6 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                        <span className="ml-2 text-gray-600">Memuat detail...</span>
                    </div>
                ) : materialDetailData ? (
                    <div className="p-6 space-y-5">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    📅 Tanggal
                                </label>
                                <p className="text-gray-900 dark:text-white">
                                    {materialDetailData.tanggal ? new Date(materialDetailData.tanggal).toLocaleString('id-ID', {
                                        day: '2-digit', month: 'long', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    }) : '-'}
                                </p>
                            </div>
                            <div>
                                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    ✏️ Dibuat Pada
                                </label>
                                <p className="text-gray-900 dark:text-white">
                                    {materialDetailData.createdAt ? new Date(materialDetailData.createdAt).toLocaleString('id-ID', {
                                        day: '2-digit', month: 'long', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    }) : '-'}
                                </p>
                            </div>
                        </div>

                        {/* Barang Info */}
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                            <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                📦 Informasi Barang
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-600 dark:text-gray-400">Kode Barang</label>
                                    <p className="font-medium text-gray-900 dark:text-white">{materialDetailData.barang?.kode || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-600 dark:text-gray-400">Nama Barang</label>
                                    <p className="font-medium text-gray-900 dark:text-white">{materialDetailData.barang?.nama || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-600 dark:text-gray-400">Jumlah</label>
                                    <p className={`text-lg font-bold ${materialDetailData.type === 'keluar' ? 'text-orange-600' : 'text-green-600'}`}>
                                        {materialDetailData.type === 'keluar' ? '-' : '+'}{materialDetailData.jumlah} {materialDetailData.barang?.satuan || ''}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-600 dark:text-gray-400">Kondisi</label>
                                    <div className="mt-1">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                            materialDetailData.kondisi === 'BARU' 
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                : materialDetailData.kondisi === 'BEKAS'
                                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                        }`}>
                                            ✓ {materialDetailData.kondisi === 'BARU' ? 'Baru' : materialDetailData.kondisi === 'BEKAS' ? 'Bekas' : 'Rusak'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Gudang Info */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                🏠 Informasi Gudang
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-600 dark:text-gray-400">Kode Gudang</label>
                                    <p className="font-medium text-gray-900 dark:text-white">{materialDetailData.gudang?.kode || '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-600 dark:text-gray-400">Nama Gudang</label>
                                    <p className="font-medium text-gray-900 dark:text-white">{materialDetailData.gudang?.nama || '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* User Info */}
                        {materialDetailData.user && (
                            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                                <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                    👤 {materialDetailData.type === 'keluar' ? 'Diambil Oleh' : 'Dikembalikan Oleh'}
                                </h3>
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                        {materialDetailData.user.name || 'Unknown'}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        {materialDetailData.user.email}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Keterangan */}
                        {materialDetailData.keterangan && (
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                    Keterangan
                                </label>
                                <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-sm">
                                    {materialDetailData.keterangan}
                                </p>
                            </div>
                        )}

                        {/* Foto Bukti */}
                        {materialDetailData.fotoBukti && materialDetailData.fotoBukti.length > 0 ? (
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    📎 Foto Bukti
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    {materialDetailData.fotoBukti.map((url, idx) => (
                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                            <img src={url} alt={`Bukti ${idx + 1}`} className="rounded-lg border-2 border-gray-200 dark:border-gray-600 h-32 w-full object-cover hover:border-indigo-500 transition-colors" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <span className="text-3xl">📷</span>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tidak ada foto bukti</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-6 text-center text-gray-500">
                        Data tidak ditemukan
                    </div>
                )}
                <ModalFooter>
                    <button
                        onClick={() => {
                            setMaterialDetailOpen(false)
                            setMaterialDetailData(null)
                        }}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
                    >
                        Tutup
                    </button>
                </ModalFooter>
            </Modal>
        </div>
    )
}
