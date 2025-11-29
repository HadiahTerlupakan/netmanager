"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
    HiArrowLeft,
    HiPencil,
    HiCheck,
    HiUserCircle,
    HiMapPin,
    HiCalendar,
    HiClock,
} from 'react-icons/hi2'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

type WorkOrderDetail = {
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
        firstName: string
        lastName: string
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
                <div className="text-gray-500">Loading...</div>
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

    const completedTasks = workOrder.tasks?.filter(t => t.status === 'COMPLETED').length || 0
    const totalTasks = workOrder.tasks?.length || 0
    const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

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
                        <div className="space-y-4">
                            {workOrder.updates && workOrder.updates.length > 0 ? (
                                workOrder.updates.map((update) => (
                                    <div key={update.id} className="flex gap-3">
                                        <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <HiClock className="w-4 h-4 text-sky-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-gray-900">{update.message}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {update.createdBy && `${update.createdBy.firstName} ${update.createdBy.lastName} · `}
                                                {format(new Date(update.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId })}
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
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-gray-600">Name</p>
                                <p className="font-medium">{workOrder.pelanggan.nama}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">ID</p>
                                <p className="font-medium">{workOrder.pelanggan.idPelanggan}</p>
                            </div>
                            {workOrder.pelanggan.email && (
                                <div>
                                    <p className="text-gray-600">Email</p>
                                    <p className="font-medium">{workOrder.pelanggan.email}</p>
                                </div>
                            )}
                            {workOrder.pelanggan.noTelp && (
                                <div>
                                    <p className="text-gray-600">Phone</p>
                                    <p className="font-medium">{workOrder.pelanggan.noTelp}</p>
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
                                    {workOrder.assignedTo.firstName} {workOrder.assignedTo.lastName}
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
                </div>
            </div>
        </div>
    )
}
