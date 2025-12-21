'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import {
    MdArrowBack,
    MdLocationOn,
    MdAccessTime,
    MdPerson,
    MdPhone,
    MdInventory2,
    MdPlayArrow,
    MdCheck,
    MdAdd,
    MdPause,
    MdSend,
    MdCheckBox,
    MdCheckBoxOutlineBlank,
    MdHistory,
    MdComment,
    MdCameraAlt,
    MdClose,
    MdImage
} from 'react-icons/md'
import Link from 'next/link'
import { useSocket, useSocketEvent } from '@/lib/websocket/SocketContext'
import { SOCKET_EVENTS, type WorkOrderActivityPayload } from '@/lib/websocket/types'

interface WorkOrderTask {
    id: string
    title: string
    description: string | null
    status: string
    order: number
    completedAt: string | null
    completedBy: { id: string; name: string } | null
}

interface WorkOrderUpdate {
    id: string
    updateType: string
    message: string
    oldStatus: string | null
    newStatus: string | null
    createdAt: string
    createdBy: { id: string; name: string } | null
}

interface WorkOrderAttachment {
    id: string
    fileName: string
    filePath: string
    fileType: string
    uploadedAt: string
    uploadedBy: { id: string; name: string } | null
}

interface WorkOrderDetail {
    id: string
    workOrderNumber: string
    title: string
    description: string
    type: string
    status: string
    priority: string
    locationAddress: string | null
    locationLat: number | null
    locationLng: number | null
    scheduledDate: string | null
    scheduledTimeStart: string | null
    scheduledTimeEnd: string | null
    contactName: string | null
    contactPhone: string | null
    pelanggan?: {
        nama: string
        alamat: string | null
        noTelp: string | null
    } | null
    assignedTo?: {
        id: string
        name: string
    } | null
    usedMaterials: any[]
    tasks: WorkOrderTask[]
    updates: WorkOrderUpdate[]
    attachments?: WorkOrderAttachment[]
    startedAt: string | null
    assignments?: {
        id: string
        role: string
        status?: string
        user: { name: string }
    }[]
}

export default function WorkOrderDetailClient() {
    const { isLoading: authLoading, isAuthenticated, user } = useKaryawanAuth()
    const [workOrder, setWorkOrder] = useState<WorkOrderDetail | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [updateMessage, setUpdateMessage] = useState('')
    const [holdReason, setHoldReason] = useState('')
    const [showHoldModal, setShowHoldModal] = useState(false)
    const [showPartnerResponseModal, setShowPartnerResponseModal] = useState(false)
    const [partnerResponseLoading, setPartnerResponseLoading] = useState(false)
    const [updatePhotos, setUpdatePhotos] = useState<File[]>([])
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
    const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)
    const photoInputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const params = useParams()
    const id = params.id as string

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/karyawan/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (isAuthenticated && id) {
            fetchWorkOrder()
        }
    }, [isAuthenticated, id])

    // WebSocket for real-time Activity Timeline
    const { socket, isConnected } = useSocket()

    // Join/leave workorder room for real-time updates
    useEffect(() => {
        if (!socket || !isConnected || !id) return

        console.log(`[KaryawanWorkOrder] Joining room workorder:${id}`)
        socket.emit(SOCKET_EVENTS.JOIN_ROOM, { room: `workorder:${id}` })

        return () => {
            console.log(`[KaryawanWorkOrder] Leaving room workorder:${id}`)
            socket.emit(SOCKET_EVENTS.LEAVE_ROOM, { room: `workorder:${id}` })
        }
    }, [socket, isConnected, id])

    // Handle real-time activity updates
    const handleNewActivity = useCallback(
        (payload: WorkOrderActivityPayload) => {
            if (payload.workOrderId !== id) return

            console.log('[KaryawanWorkOrder] New activity received:', payload.activity.type)

            // Refresh data to get the new activity
            fetchWorkOrder()
        },
        [id]
    )

    // Subscribe to WebSocket activity events
    useSocketEvent(SOCKET_EVENTS.WORKORDER_ACTIVITY, handleNewActivity)

    const fetchWorkOrder = async () => {
        try {
            const res = await fetch(`/api/karyawan/work-order/${id}`)
            if (res.ok) {
                const data = await res.json()
                setWorkOrder(data.workOrder)
            } else {
                router.push('/karyawan/work-order')
            }
        } catch (error) {
            console.error('Failed to fetch work order:', error)
        } finally {
            setIsLoading(false)
        }
    }



    const handleTakeTicket = async () => {
        if (!workOrder) return
        setIsSubmitting(true)
        try {
            const res = await fetch('/api/karyawan/work-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workOrderId: workOrder.id })
            })
            if (res.ok) {
                await fetchWorkOrder()
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal mengambil tiket')
            }
        } catch (error) {
            console.error('Failed to take ticket:', error)
            alert('Terjadi kesalahan')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleStartWork = async () => {
        if (!workOrder) return
        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/karyawan/work-order/${id}/start`, {
                method: 'POST'
            })
            if (res.ok) {
                await fetchWorkOrder()
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal memulai pekerjaan')
            }
        } catch (error) {
            console.error('Failed to start work:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handlePartnerResponse = async (response: 'APPROVED' | 'REJECTED') => {
        setPartnerResponseLoading(true)
        try {
            const res = await fetch(`/api/karyawan/work-order/${id}/partner-response`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ response })
            })
            if (res.ok) {
                setShowPartnerResponseModal(false)
                await fetchWorkOrder()
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal merespon')
            }
        } catch (error) {
            console.error('Failed to respond:', error)
            alert('Terjadi kesalahan')
        } finally {
            setPartnerResponseLoading(false)
        }
    }

    const handleHold = async () => {
        if (!workOrder) return
        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/karyawan/work-order/${id}/hold`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: holdReason })
            })
            if (res.ok) {
                setShowHoldModal(false)
                setHoldReason('')
                await fetchWorkOrder()
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal hold')
            }
        } catch (error) {
            console.error('Failed to hold:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleResume = async () => {
        if (!workOrder) return
        setIsSubmitting(true)
        try {
            const res = await fetch(`/api/karyawan/work-order/${id}/resume`, {
                method: 'POST'
            })
            if (res.ok) {
                await fetchWorkOrder()
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal melanjutkan')
            }
        } catch (error) {
            console.error('Failed to resume:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleToggleTask = async (taskId: string) => {
        if (!workOrder) return
        try {
            const res = await fetch(`/api/karyawan/work-order/${id}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId })
            })
            if (res.ok) {
                await fetchWorkOrder()
            }
        } catch (error) {
            console.error('Failed to toggle task:', error)
        }
    }

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        const newFiles: File[] = []
        const newPreviews: string[] = []

        for (let i = 0; i < files.length && updatePhotos.length + newFiles.length < 5; i++) {
            if (files[i].type.startsWith('image/')) {
                newFiles.push(files[i])
                newPreviews.push(URL.createObjectURL(files[i]))
            }
        }

        setUpdatePhotos([...updatePhotos, ...newFiles])
        setPhotoPreviews([...photoPreviews, ...newPreviews])
        if (photoInputRef.current) photoInputRef.current.value = ''
    }

    const removePhoto = (index: number) => {
        URL.revokeObjectURL(photoPreviews[index])
        setUpdatePhotos(updatePhotos.filter((_, i) => i !== index))
        setPhotoPreviews(photoPreviews.filter((_, i) => i !== index))
    }

    const uploadPhotosToServer = async (): Promise<string[]> => {
        const uploadedUrls: string[] = []
        for (const photo of updatePhotos) {
            const formData = new FormData()
            formData.append('file', photo)
            formData.append('type', 'work-order-updates')
            formData.append('subFolder', id)
            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                })
                if (res.ok) {
                    const data = await res.json()
                    uploadedUrls.push(data.url)
                }
            } catch (error) {
                console.error('Error uploading photo:', error)
            }
        }
        return uploadedUrls
    }

    const handleSendUpdate = async () => {
        if (!workOrder || (!updateMessage.trim() && updatePhotos.length === 0)) return
        setIsUploadingPhotos(true)
        try {
            // Upload photos first
            const photoUrls = await uploadPhotosToServer()

            const res = await fetch(`/api/karyawan/work-order/${id}/updates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: updateMessage,
                    photos: photoUrls
                })
            })
            if (res.ok) {
                setUpdateMessage('')
                setUpdatePhotos([])
                photoPreviews.forEach(p => URL.revokeObjectURL(p))
                setPhotoPreviews([])
                await fetchWorkOrder()
            }
        } catch (error) {
            console.error('Failed to send update:', error)
        } finally {
            setIsUploadingPhotos(false)
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'URGENT':
            case 'CRITICAL':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            case 'HIGH':
                return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            case 'NORMAL':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'IN_PROGRESS':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            case 'ON_HOLD':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            case 'COMPLETED':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            default:
                return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)

        if (minutes < 1) return 'Baru saja'
        if (minutes < 60) return `${minutes} menit lalu`
        if (hours < 24) return `${hours} jam lalu`
        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    }

    const isAssignedToMe = workOrder?.assignedTo?.id === user?.id
    const isPartner = workOrder?.assignments?.some(a => a.role === 'PARTNER' && a.user?.name === user?.name)
    const myPartnerAssignment = workOrder?.assignments?.find(a => a.role === 'PARTNER' && a.user?.name === user?.name)
    const partnerList = workOrder?.assignments?.filter(a => a.role === 'PARTNER') || []
    const hasPendingPartners = partnerList.some(a => a.status === 'PENDING')
    const allPartnersResponded = partnerList.length === 0 || partnerList.every(a => a.status !== 'PENDING')
    const canTakeTicket = workOrder?.status === 'PENDING' && !workOrder?.assignedTo
    const canStartWork = isAssignedToMe && workOrder?.status === 'ASSIGNED' && allPartnersResponded
    const canHold = isAssignedToMe && workOrder?.status === 'IN_PROGRESS'
    const canResume = isAssignedToMe && workOrder?.status === 'ON_HOLD'
    const canAddMaterial = isAssignedToMe && workOrder?.status === 'IN_PROGRESS'

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!workOrder) {
        return null
    }

    // Combine updates and attachments for timeline
    const timelineItems = [
        ...(workOrder.updates || []).map(u => ({ ...u, type: 'update' })),
        ...(workOrder.attachments || []).map(a => ({ ...a, type: 'attachment', createdAt: a.uploadedAt }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased">
            <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">

                {/* Header */}
                <div className="sticky top-0 z-20 bg-[#f6f7f8] dark:bg-[#101922] border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center p-4 justify-between">
                        <Link href="/karyawan/work-order" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <MdArrowBack className="text-2xl" />
                        </Link>
                        <div className="flex-1 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{workOrder.workOrderNumber}</p>
                            <h2 className="text-sm font-bold leading-tight">Detail Work Order</h2>
                        </div>
                        <div className="w-10" />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 pb-32 px-4 pt-4 space-y-4">
                    {/* Title & Status */}
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                        <h1 className="text-lg font-bold text-[#111418] dark:text-white mb-3">
                            {workOrder.title}
                        </h1>
                        <div className="flex flex-wrap gap-2">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getPriorityColor(workOrder.priority)}`}>
                                {workOrder.priority}
                            </span>
                            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                {workOrder.type}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusColor(workOrder.status)}`}>
                                {workOrder.status.replace('_', ' ')}
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Deskripsi</h3>
                        <p className="text-sm text-[#111418] dark:text-white whitespace-pre-wrap">
                            {workOrder.description}
                        </p>
                    </div>

                    {/* Schedule & Location */}
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3">
                        <div className="flex items-start gap-3">
                            <MdAccessTime className="text-xl text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Jadwal</p>
                                <p className="text-sm font-medium dark:text-white">{formatDate(workOrder.scheduledDate)}</p>
                                {workOrder.scheduledTimeStart && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {workOrder.scheduledTimeStart} - {workOrder.scheduledTimeEnd || 'selesai'}
                                    </p>
                                )}
                                {workOrder.startedAt && (
                                    <>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Waktu Mulai</p>
                                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                                            {formatDate(workOrder.startedAt)} • {new Date(workOrder.startedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                        {workOrder.locationAddress && (
                            <div className="flex items-start gap-3">
                                <MdLocationOn className="text-xl text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Lokasi</p>
                                    <p className="text-sm font-medium dark:text-white">{workOrder.locationAddress}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Contact */}
                    {(workOrder.contactName || workOrder.pelanggan) && (
                        <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Kontak</h3>
                            <div className="flex items-center gap-3">
                                <MdPerson className="text-xl text-gray-400" />
                                <p className="text-sm font-medium dark:text-white">
                                    {workOrder.contactName || workOrder.pelanggan?.nama}
                                </p>
                            </div>
                            {(workOrder.contactPhone || workOrder.pelanggan?.noTelp) && (
                                <a
                                    href={`tel:${workOrder.contactPhone || workOrder.pelanggan?.noTelp}`}
                                    className="flex items-center gap-3 text-blue-600"
                                >
                                    <MdPhone className="text-xl" />
                                    <p className="text-sm font-medium">
                                        {workOrder.contactPhone || workOrder.pelanggan?.noTelp}
                                    </p>
                                </a>
                            )}
                        </div>
                    )}



                    {/* Tasks Checklist */}
                    {workOrder.tasks && workOrder.tasks.length > 0 && (
                        <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                                <MdCheckBox className="text-lg" />
                                Tasks Checklist
                            </h3>
                            <div className="space-y-2">
                                {workOrder.tasks.map((task) => {
                                    const canCheck = canAddMaterial && task.status !== 'COMPLETED'
                                    return (
                                        <button
                                            key={task.id}
                                            onClick={() => canCheck && handleToggleTask(task.id)}
                                            disabled={!canCheck}
                                            className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${task.status === 'COMPLETED'
                                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                                                } ${canCheck ? 'hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer' : 'cursor-default'}`}
                                        >
                                            {task.status === 'COMPLETED' ? (
                                                <MdCheckBox className="text-xl text-green-600 shrink-0 mt-0.5" />
                                            ) : (
                                                <MdCheckBoxOutlineBlank className="text-xl text-gray-400 shrink-0 mt-0.5" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium ${task.status === 'COMPLETED' ? 'line-through text-gray-500' : 'dark:text-white'}`}>
                                                    {task.title}
                                                </p>
                                                {task.description && (
                                                    <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                                                )}
                                                {task.completedBy && (
                                                    <p className="text-xs text-green-600 mt-1">
                                                        ✓ {task.completedBy.name}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Materials Used */}
                    {canAddMaterial && (
                        <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Barang Digunakan</h3>
                                <Link href={`/karyawan/work-order/${id}/ambil-barang`}>
                                    <button className="flex items-center gap-1 text-blue-600 text-sm font-medium">
                                        <MdAdd className="text-lg" />
                                        Ambil Barang
                                    </button>
                                </Link>
                            </div>
                            {workOrder.usedMaterials && Array.isArray(workOrder.usedMaterials) && workOrder.usedMaterials.length > 0 ? (
                                <div className="space-y-2">
                                    {workOrder.usedMaterials.map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm dark:text-white">{item.nama}</span>
                                                {item.kondisi && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${item.kondisi === 'BARU' ? 'bg-green-100 text-green-700' :
                                                        item.kondisi === 'BEKAS' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-red-100 text-red-700'
                                                        }`}>{item.kondisi}</span>
                                                )}
                                            </div>
                                            <span className="text-sm text-gray-500">{item.jumlah} {item.satuan}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 text-center py-4">Belum ada barang</p>
                            )}
                        </div>
                    )}


                    {/* Partners Info */}
                    {workOrder.assignments && workOrder.assignments.filter(a => a.role === 'PARTNER').length > 0 && (
                        <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                                <MdPerson className="text-lg" />
                                Partner Kerja
                            </h3>
                            <div className="space-y-2">
                                {workOrder.assignments
                                    .filter(a => a.role === 'PARTNER')
                                    .map(assignment => (
                                        <div key={assignment.id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs">
                                                    {assignment.user.name?.charAt(0).toUpperCase()}
                                                </div>
                                                <p className="text-sm font-medium dark:text-white">
                                                    {assignment.user.name}
                                                </p>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${assignment.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                assignment.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {assignment.status === 'APPROVED' ? 'Setuju' :
                                                    assignment.status === 'REJECTED' ? 'Tolak' : 'Menunggu'}
                                            </span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {/* Activity Timeline */}
                    <div className="bg-white dark:bg-[#1c2936] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                            <MdHistory className="text-lg" />
                            Activity Timeline
                        </h3>



                        {/* Add Update Form */}
                        {isAssignedToMe && (workOrder.status === 'IN_PROGRESS' || workOrder.status === 'ON_HOLD') && (
                            <div className="mb-4 space-y-3">
                                {/* Photo Previews */}
                                {photoPreviews.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {photoPreviews.map((preview, index) => (
                                            <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                                                <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => removePhoto(index)}
                                                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                                                >
                                                    <MdClose className="text-xs" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Input Row */}
                                <div className="flex gap-2">
                                    <input
                                        ref={photoInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handlePhotoSelect}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => photoInputRef.current?.click()}
                                        disabled={photoPreviews.length >= 5}
                                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 disabled:opacity-50"
                                    >
                                        <MdCameraAlt className="text-lg text-blue-600" />
                                    </button>
                                    <input
                                        type="text"
                                        value={updateMessage}
                                        onChange={(e) => setUpdateMessage(e.target.value)}
                                        placeholder="Tulis update..."
                                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-white"
                                        onKeyPress={(e) => e.key === 'Enter' && !isUploadingPhotos && handleSendUpdate()}
                                    />
                                    <button
                                        onClick={handleSendUpdate}
                                        disabled={isUploadingPhotos || (!updateMessage.trim() && updatePhotos.length === 0)}
                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                                    >
                                        {isUploadingPhotos ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <MdSend className="text-lg" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Timeline List */}
                        <div className="space-y-3">
                            {timelineItems.length > 0 ? (
                                timelineItems.map((item: any) => (
                                    <div key={`${item.type}-${item.id}`} className="flex gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.type === 'attachment'
                                            ? 'bg-purple-100 dark:bg-purple-900/30'
                                            : item.updateType === 'STATUS_CHANGE'
                                                ? 'bg-blue-100 dark:bg-blue-900/30'
                                                : item.updateType === 'TASK_UPDATE'
                                                    ? 'bg-green-100 dark:bg-green-900/30'
                                                    : 'bg-gray-100 dark:bg-gray-800'
                                            }`}>
                                            {item.type === 'attachment' ? (
                                                <MdImage className="text-purple-600 text-sm" />
                                            ) : item.updateType === 'STATUS_CHANGE' ? (
                                                <MdPlayArrow className="text-blue-600 text-sm" />
                                            ) : item.updateType === 'TASK_UPDATE' ? (
                                                <MdCheck className="text-green-600 text-sm" />
                                            ) : (
                                                <MdComment className="text-gray-500 text-sm" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {item.type === 'attachment' ? (
                                                <div className="space-y-1">
                                                    <p className="text-sm dark:text-white">Mengupload foto</p>
                                                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 max-w-[200px]">
                                                        <img
                                                            src={item.filePath}
                                                            alt={item.fileName}
                                                            className="w-full h-auto object-cover"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm dark:text-white">{item.message}</p>
                                            )}
                                            <p className="text-xs text-gray-500 mt-1">
                                                {item.type === 'attachment'
                                                    ? (item.uploadedBy?.name || 'System')
                                                    : (item.createdBy?.name || 'System')} • {formatTime(item.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-400 text-center py-4">Belum ada aktivitas</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="fixed bottom-20 left-0 right-0 p-4 bg-[#f6f7f8] dark:bg-[#101922] border-t border-gray-100 dark:border-gray-800 max-w-md mx-auto">
                    {canTakeTicket && (
                        <button
                            onClick={handleTakeTicket}
                            disabled={isSubmitting}
                            className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <MdCheck className="text-xl" />
                            {isSubmitting ? 'Memproses...' : 'Ambil Tiket Ini'}
                        </button>
                    )}
                    {/* Partner Response Button - for partners who haven't responded */}
                    {isPartner && myPartnerAssignment?.status === 'PENDING' && (
                        <button
                            onClick={() => setShowPartnerResponseModal(true)}
                            className="w-full bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <MdPerson className="text-xl" />
                            Tanggapi Permintaan Partner
                        </button>
                    )}
                    {canStartWork && (
                        <div className="space-y-3">
                            <Link href={`/karyawan/work-order/${id}/partners`} className="block w-full">
                                <button className="w-full bg-white dark:bg-[#1c2936] text-blue-600 font-bold py-3.5 px-4 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2">
                                    <MdPerson className="text-xl" />
                                    Atur Partner
                                </button>
                            </Link>
                            <button
                                onClick={handleStartWork}
                                disabled={isSubmitting}
                                className="w-full bg-green-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <MdPlayArrow className="text-xl" />
                                {isSubmitting ? 'Memproses...' : 'Mulai Kerjakan'}
                            </button>
                        </div>
                    )}
                    {/* Warning: Waiting for partner response */}
                    {isAssignedToMe && workOrder?.status === 'ASSIGNED' && hasPendingPartners && (
                        <div className="space-y-3">
                            <Link href={`/karyawan/work-order/${id}/partners`} className="block w-full">
                                <button className="w-full bg-white dark:bg-[#1c2936] text-blue-600 font-bold py-3.5 px-4 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2">
                                    <MdPerson className="text-xl" />
                                    Atur Partner
                                </button>
                            </Link>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 text-center">
                                <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                                    Menunggu tanggapan dari partner kerja sebelum bisa mulai bekerja
                                </p>
                            </div>
                        </div>
                    )}
                    {canHold && (
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowHoldModal(true)}
                                className="flex-1 bg-yellow-500 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <MdPause className="text-xl" />
                                Hold
                            </button>
                            <Link href={`/karyawan/work-order/${id}/ambil-barang`} className="flex-1">
                                <button className="w-full bg-white dark:bg-[#1c2936] text-blue-600 font-bold py-3.5 px-4 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2">
                                    <MdInventory2 className="text-xl" />
                                    Barang
                                </button>
                            </Link>
                            <Link href={`/karyawan/work-order/${id}/selesai`} className="flex-1">
                                <button className="w-full bg-green-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                                    <MdCheck className="text-xl" />
                                    Selesai
                                </button>
                            </Link>
                        </div>
                    )}
                    {canResume && (
                        <button
                            onClick={handleResume}
                            disabled={isSubmitting}
                            className="w-full bg-green-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <MdPlayArrow className="text-xl" />
                            {isSubmitting ? 'Memproses...' : 'Lanjutkan Pekerjaan'}
                        </button>
                    )}
                </div>

                {/* Hold Modal */}
                {showHoldModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white dark:bg-[#1c2936] rounded-xl p-5 w-full max-w-sm">
                            <h3 className="text-lg font-bold dark:text-white mb-3">Hold Work Order</h3>
                            <p className="text-sm text-gray-500 mb-4">Masukkan alasan hold (opsional):</p>
                            <textarea
                                value={holdReason}
                                onChange={(e) => setHoldReason(e.target.value)}
                                placeholder="Contoh: Menunggu barang..."
                                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 dark:text-white resize-none"
                                rows={3}
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setShowHoldModal(false)}
                                    className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleHold}
                                    disabled={isSubmitting}
                                    className="flex-1 py-2.5 rounded-lg bg-yellow-500 text-white font-medium disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Partner Response Modal */}
                {showPartnerResponseModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-[#1c2936] rounded-2xl w-full max-w-sm shadow-xl">
                            <div className="p-5">
                                <h3 className="text-lg font-bold dark:text-white mb-2">Konfirmasi Partner</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    Apakah Anda bersedia menjadi partner di Work Order ini?
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handlePartnerResponse('REJECTED')}
                                        disabled={partnerResponseLoading}
                                        className="flex-1 py-2.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 font-medium disabled:opacity-50"
                                    >
                                        Tolak
                                    </button>
                                    <button
                                        onClick={() => handlePartnerResponse('APPROVED')}
                                        disabled={partnerResponseLoading}
                                        className="flex-1 py-2.5 rounded-lg bg-green-600 text-white font-medium disabled:opacity-50"
                                    >
                                        {partnerResponseLoading ? 'Memproses...' : 'Setuju'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
