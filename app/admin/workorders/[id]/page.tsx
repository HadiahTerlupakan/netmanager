"use client"

import { useState, useEffect } from 'react'
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
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

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
    updates?: Array<{
        id: string
        updateType: string
        message: string
        createdAt: string
        createdBy?: {
            firstName: string
            lastName: string
        } | null
    }>
    attachments?: Array<{
        id: string
        fileName: string
        filePath: string
        fileType: string
        caption: string | null
        uploadedAt: string
        uploadedBy?: {
            name: string
        } | null
    }>
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

export default function WorkOrderDetailPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const params = useParams()
    const workOrderId = params?.id as string

    const [loading, setLoading] = useState(true)
    const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null)
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
    const [cancelReason, setCancelReason] = useState('')
    const [processingApproval, setProcessingApproval] = useState(false)

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }

        if (session?.user && status === 'authenticated') {
            fetchWorkOrder()
        }
    }, [session, status, router, workOrderId])

    const fetchWorkOrder = async () => {
        try {
            const response = await fetch(`/api/admin/workorders/${workOrderId}`)
            if (response.ok) {
                const result = await response.json()
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
        } catch (error) {
            console.error('Error fetching work order:', error)
        } finally {
            setLoading(false)
        }
    }

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
    const timelineItems = [
        ...(workOrder.updates || []).map(u => ({
            type: u.updateType === 'COMMENT' ? 'comment' : 'update',
            date: new Date(u.createdAt),
            id: u.id,
            data: u
        })),
        ...(workOrder.attachments || [])
            .filter(a => !a.caption?.startsWith('[COMPLETION]'))
            .map(a => ({ type: 'attachment', date: new Date(a.uploadedAt), id: a.id, data: a }))
    ].sort((a, b) => b.date.getTime() - a.date.getTime())

    // Filter completion photos
    const completionAttachments = workOrder.attachments?.filter(a => a.caption?.startsWith('[COMPLETION]')) || []

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
                {workOrder.status !== 'CANCELLED' && workOrder.status !== 'CLOSED' && workOrder.status !== 'COMPLETED' && (
                    <button
                        onClick={() => setShowCancelModal(true)}
                        disabled={processingApproval}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                        <HiXMark className="w-5 h-5" />
                        Batalkan
                    </button>
                )}
                {workOrder.status === 'COMPLETED' && (
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
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {editMode === 'status' ? (
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={editValues.status}
                                            onChange={(e) => setEditValues({ ...editValues, status: e.target.value })}
                                            className="px-3 py-1 border rounded text-sm"
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
                                            className="p-1 bg-green-500 text-white rounded"
                                        >
                                            <HiCheck className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setEditMode('status')}
                                        className="flex items-center gap-1 hover:bg-gray-50 rounded px-2 py-1"
                                    >
                                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[workOrder.status]}`}>
                                            {workOrder.status.replace('_', ' ')}
                                        </span>
                                        <HiPencil className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}

                                {editMode === 'priority' ? (
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={editValues.priority}
                                            onChange={(e) => setEditValues({ ...editValues, priority: e.target.value })}
                                            className="px-3 py-1 border rounded text-sm"
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="NORMAL">Normal</option>
                                            <option value="HIGH">High</option>
                                            <option value="URGENT">Urgent</option>
                                            <option value="CRITICAL">Critical</option>
                                        </select>
                                        <button
                                            onClick={() => handleUpdateField('priority')}
                                            className="p-1 bg-green-500 text-white rounded"
                                        >
                                            <HiCheck className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setEditMode('priority')}
                                        className="flex items-center gap-1 hover:bg-gray-50 rounded px-2 py-1"
                                    >
                                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 rounded">
                                            {workOrder.priority}
                                        </span>
                                        <HiPencil className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="text-gray-600">Type:</span>{' '}
                                <span className="font-medium">{workOrder.type}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">Description:</span>
                                <p className="mt-1 text-gray-900">{workOrder.description}</p>
                            </div>
                            {workOrder.ticket && (
                                <div>
                                    <span className="text-gray-600">Related Ticket:</span>{' '}
                                    <Link
                                        href={`/admin/helpdesk/tiket/${workOrder.ticket.ticketNumber.split('-').pop()}`}
                                        className="text-sky-600 hover:underline"
                                    >
                                        {workOrder.ticket.ticketNumber}
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tasks Checklist */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900">Tasks Checklist</h3>
                            <span className="text-sm text-gray-600">
                                {completedTasks}/{totalTasks} completed
                            </span>
                        </div>

                        {totalTasks > 0 && (
                            <div className="mb-4">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-sky-600 h-2 rounded-full transition-all"
                                        style={{ width: `${progressPercent}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 mb-4">
                            {workOrder.tasks?.map((task) => (
                                <div key={task.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                                    <input
                                        type="checkbox"
                                        checked={task.status === 'COMPLETED'}
                                        readOnly
                                        className="rounded border-gray-300"
                                    />
                                    <span className={task.status === 'COMPLETED' ? 'line-through text-gray-500' : ''}>
                                        {task.title}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTask}
                                onChange={(e) => setNewTask(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                                placeholder="Add new task..."
                                className="flex-1 px-3 py-2 border rounded-lg text-sm"
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
                    </div>

                    {/* Timeline */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Activity Timeline</h3>

                        {/* New Comment Input */}
                        <div className="mb-6 flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">
                                <HiUserCircle className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Write a comment or ask a question..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 min-h-[80px]"
                                />
                                <div className="flex justify-end mt-2">
                                    <button
                                        onClick={handleAddComment}
                                        disabled={addingComment || !newComment.trim()}
                                        className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700 disabled:opacity-50"
                                    >
                                        {addingComment ? 'Posting...' : 'Post Comment'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {timelineItems.length > 0 ? (
                                timelineItems.map((item) => (
                                    <div key={item.id} className="flex gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            // @ts-ignore
                                            item.type === 'comment' ? 'bg-indigo-100' :
                                                // @ts-ignore
                                                item.type === 'update' ? 'bg-sky-100' : 'bg-orange-100'
                                            }`}>
                                            {
                                                // @ts-ignore
                                                item.type === 'comment' ? (
                                                    <HiChatBubbleLeft className="w-4 h-4 text-indigo-600" />
                                                ) :
                                                    // @ts-ignore
                                                    item.type === 'update' ? (
                                                        <HiClock className="w-4 h-4 text-sky-600" />
                                                    ) : (
                                                        <HiPhoto className="w-4 h-4 text-orange-600" />
                                                    )}
                                        </div>
                                        <div className="flex-1">
                                            {
                                                // @ts-ignore
                                                item.type === 'update' || item.type === 'comment' ? (
                                                    <div className={`${(item.data as any).updateType === 'COMMENT' ? 'bg-gray-50 p-3 rounded-lg border border-gray-100' : ''}`}>
                                                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{(item.data as any).message}</p>
                                                    </div>
                                                ) : (
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mb-1 inline-block">
                                                        <a
                                                            href={(item.data as any).filePath}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="block"
                                                        >
                                                            <img
                                                                src={(item.data as any).filePath}
                                                                alt={(item.data as any).caption || 'Attachment'}
                                                                className="h-40 rounded-lg object-cover mb-2"
                                                            />
                                                        </a>
                                                        {(item.data as any).caption && (
                                                            <p className="text-xs text-gray-600 italic">
                                                                {(item.data as any).caption.replace(/^\[(HOLD|NOTE)\]\s*/, '')}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            <p className="text-xs text-gray-500 mt-1">
                                                {item.type === 'update' ? (
                                                    <>
                                                        {(item.data as any).createdBy && `${(item.data as any).createdBy.firstName} ${(item.data as any).createdBy.lastName} · `}
                                                        {format(item.date, 'dd MMM yyyy HH:mm', { locale: localeId })}
                                                    </>
                                                ) : (
                                                    <>
                                                        {(item.data as any).uploadedBy && `${(item.data as any).uploadedBy.name} · `}
                                                        {format(item.date, 'dd MMM yyyy HH:mm', { locale: localeId })}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-500">No activity yet</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Customer Info */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <HiUserCircle className="w-5 h-5" />
                            Customer Info
                            {!workOrder.pelanggan && (
                                <span className="text-xs font-normal bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Guest</span>
                            )}
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-gray-600">Name</p>
                                <p className="font-medium">{workOrder.pelanggan?.nama || workOrder.contactName || '-'}</p>
                            </div>
                            {workOrder.pelanggan?.idPelanggan && (
                                <div>
                                    <p className="text-gray-600">ID</p>
                                    <p className="font-medium">{workOrder.pelanggan.idPelanggan}</p>
                                </div>
                            )}
                            {(workOrder.pelanggan?.email) && (
                                <div>
                                    <p className="text-gray-600">Email</p>
                                    <p className="font-medium">{workOrder.pelanggan.email}</p>
                                </div>
                            )}
                            {(workOrder.pelanggan?.noTelp || workOrder.contactPhone) && (
                                <div>
                                    <p className="text-gray-600">Phone</p>
                                    <p className="font-medium">{workOrder.pelanggan?.noTelp || workOrder.contactPhone}</p>
                                </div>
                            )}
                            {workOrder.locationAddress && (
                                <div>
                                    <p className="text-gray-600">Address</p>
                                    <p className="font-medium">{workOrder.locationAddress}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Assignment */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Assignment</h3>
                        {workOrder.assignedTo ? (
                            <div className="text-sm">
                                <p className="text-gray-600">Assigned to:</p>
                                <p className="font-medium text-gray-900">
                                    {workOrder.assignedTo.name}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">Not assigned yet</p>
                        )}
                        {workOrder.department && (
                            <div className="text-sm mt-3">
                                <p className="text-gray-600">Department:</p>
                                <p className="font-medium text-gray-900">{workOrder.department.name}</p>
                            </div>
                        )}
                    </div>

                    {/* Schedule */}
                    {workOrder.scheduledDate && (
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <HiCalendar className="w-5 h-5" />
                                Schedule
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <p className="text-gray-600">Date</p>
                                    <p className="font-medium">
                                        {format(new Date(workOrder.scheduledDate), 'dd MMM yyyy', { locale: localeId })}
                                    </p>
                                </div>
                                {workOrder.scheduledTimeStart && (
                                    <div>
                                        <p className="text-gray-600">Time</p>
                                        <p className="font-medium">
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
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <HiMapPin className="w-5 h-5" />
                                Location
                            </h3>
                            <p className="text-sm text-gray-900">{workOrder.locationAddress}</p>
                            {workOrder.contactName && (
                                <div className="mt-3 text-sm">
                                    <p className="text-gray-600">Contact</p>
                                    <p className="font-medium">{workOrder.contactName}</p>
                                    {workOrder.contactPhone && (
                                        <p className="text-gray-600">{workOrder.contactPhone}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Completion Photos */}
                    {completionAttachments.length > 0 && (
                        <div className="bg-white rounded-lg shadow p-6">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <HiPhoto className="w-5 h-5" />
                                Bukti Penyelesaian ({completionAttachments.length} foto)
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {completionAttachments.map((attachment) => (
                                    <a
                                        key={attachment.id}
                                        href={attachment.filePath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block relative group"
                                    >
                                        <img
                                            src={attachment.filePath}
                                            alt={attachment.caption || 'Bukti Penyelesaian'}
                                            className="w-full h-32 object-cover rounded-lg border border-gray-200 group-hover:opacity-90 transition-opacity"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                            <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium transition-opacity">
                                                Lihat
                                            </span>
                                        </div>
                                        {attachment.caption && (
                                            <p className="text-xs text-gray-500 mt-1 text-center truncate">
                                                {attachment.caption.replace(/^\[COMPLETION\]\s*/, '')}
                                            </p>
                                        )}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tolak Hasil Pekerjaan</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Work order akan dikembalikan ke status In Progress. Silakan berikan alasan penolakan untuk petugas.
                            </p>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Alasan penolakan (wajib diisi)..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px]"
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false)
                                        setRejectReason('')
                                    }}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
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
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Batalkan Work Order</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                Tindakan ini tidak dapat dibatalkan. Work order akan ditandai sebagai Cancelled.
                            </p>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Alasan pembatalan (wajib diisi)..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 min-h-[100px]"
                            />
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => {
                                        setShowCancelModal(false)
                                        setCancelReason('')
                                    }}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
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
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                    <HiCheckCircle className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">Verifikasi Work Order</h3>
                            </div>

                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                                Apakah Anda yakin ingin memverifikasi work order ini?
                                <br />
                                <span className="font-medium text-gray-900">Status akan berubah menjadi VERIFIED dan stok barang akan terpotong secara permanen.</span>
                            </p>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowVerifyModal(false)}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
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
        </div>
    )
}
