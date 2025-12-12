"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
    HiArrowLeft,
    HiMapPin,
    HiPhone,
    HiClock,
    HiCheckCircle,
    HiExclamationCircle,
    HiChatBubbleLeftEllipsis,
    HiPlay,
    HiPause,
    HiHandRaised,
    HiArrowUturnLeft,
    HiPaperAirplane,
    HiListBullet,
    HiCamera,
    HiXMark,
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

type Task = {
    id: string
    title: string
    description: string | null
    status: string
    order: number
    completedAt: string | null
}

type Update = {
    id: string
    updateType: string
    message: string
    createdAt: string
    createdBy?: { fullName: string } | null
}

type WorkOrder = {
    id: string
    workOrderNumber: string
    title: string
    description: string
    priority: string
    status: string
    type: string
    scheduledDate: string | null
    locationAddress: string | null
    contactName: string | null
    contactPhone: string | null
    assignedToId: string | null
    assignedTo?: { id: string; fullName: string } | null
    site?: { code: string; name: string } | null
    pelanggan: {
        nama: string
        noTelp: string | null
        alamat: string | null
        idPelanggan: string
    } | null
    tasks?: Task[]
    updates?: Update[]
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-800 border-gray-200',
    ASSIGNED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
    ON_HOLD: 'bg-orange-50 text-orange-700 border-orange-200',
    COMPLETED: 'bg-green-50 text-green-700 border-green-200',
    VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

export default function EmployeeWorkOrderDetail() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const params = useParams()
    const id = params?.id as string

    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [showNoteForm, setShowNoteForm] = useState(false)
    const [noteText, setNoteText] = useState('')
    const [employeeId, setEmployeeId] = useState<string | null>(null)
    // Completion modal states
    const [showCompleteModal, setShowCompleteModal] = useState(false)
    const [completionPhotos, setCompletionPhotos] = useState<File[]>([])
    const [completionPhotoPreviews, setCompletionPhotoPreviews] = useState<string[]>([])
    const [completionNote, setCompletionNote] = useState('')
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const MAX_PHOTOS = 5
    // Hold modal states
    const [showHoldModal, setShowHoldModal] = useState(false)
    const [holdPhoto, setHoldPhoto] = useState<File | null>(null)
    const [holdPhotoPreview, setHoldPhotoPreview] = useState<string | null>(null)
    const [holdReason, setHoldReason] = useState('')
    // Note photo states
    const [notePhoto, setNotePhoto] = useState<File | null>(null)
    const [notePhotoPreview, setNotePhotoPreview] = useState<string | null>(null)

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login')
        if (id && status === 'authenticated') {
            loadWorkOrder()
            loadEmployee()
        }
    }, [id, status])

    const loadWorkOrder = async () => {
        try {
            const response = await fetch(`/api/employee/workorders/${id}`)
            if (response.ok) {
                const result = await response.json()
                setWorkOrder(result.data)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadEmployee = async () => {
        try {
            const response = await fetch('/api/employee/me')
            if (response.ok) {
                const result = await response.json()
                // The /api/employee/me returns { employee: { id: ... }, ... }
                setEmployeeId(result.employee?.id || null)
            }
        } catch (error) {
            console.error('Error loading employee:', error)
        }
    }

    const performAction = async (action: string, data?: any) => {
        setActionLoading(true)
        try {
            const response = await fetch(`/api/employee/workorders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data }),
            })
            if (response.ok) {
                await loadWorkOrder()
                setShowNoteForm(false)
                setNoteText('')
            } else {
                const error = await response.json()
                alert(error.error || 'Action failed')
            }
        } catch (error) {
            console.error('Error:', error)
            alert('An error occurred')
        } finally {
            setActionLoading(false)
        }
    }

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files) return

        const newFiles = Array.from(files).slice(0, MAX_PHOTOS - completionPhotos.length)
        if (newFiles.length === 0) return

        // Add files to state
        setCompletionPhotos(prev => [...prev, ...newFiles].slice(0, MAX_PHOTOS))

        // Generate previews
        newFiles.forEach(file => {
            const reader = new FileReader()
            reader.onloadend = () => {
                setCompletionPhotoPreviews(prev => [...prev, reader.result as string].slice(0, MAX_PHOTOS))
            }
            reader.readAsDataURL(file)
        })

        // Reset input
        e.target.value = ''
    }

    const removePhoto = (index: number) => {
        setCompletionPhotos(prev => prev.filter((_, i) => i !== index))
        setCompletionPhotoPreviews(prev => prev.filter((_, i) => i !== index))
    }

    const handleCompleteWithPhoto = async () => {
        if (completionPhotos.length === 0) {
            alert('Mohon upload minimal 1 foto bukti penyelesaian')
            return
        }

        setUploadingPhoto(true)
        try {
            // Upload all photos
            const uploadedUrls: string[] = []

            for (const photo of completionPhotos) {
                const formData = new FormData()
                formData.append('file', photo)
                formData.append('type', 'workorder-completion')
                formData.append('workOrderId', id)

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                })

                if (!uploadRes.ok) {
                    throw new Error('Gagal upload foto')
                }

                const uploadData = await uploadRes.json()
                uploadedUrls.push(uploadData.url)
            }

            // Complete the work order with all attachment URLs
            await performAction('complete', {
                attachmentUrls: uploadedUrls,
                note: completionNote || 'Pekerjaan selesai'
            })

            // Reset modal states
            setShowCompleteModal(false)
            setCompletionPhotos([])
            setCompletionPhotoPreviews([])
            setCompletionNote('')
        } catch (error: any) {
            console.error('Error completing with photo:', error)
            alert(error.message || 'Gagal menyelesaikan work order')
        } finally {
            setUploadingPhoto(false)
        }
    }

    // Hold photo handlers
    const handleHoldPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setHoldPhoto(file)
            const reader = new FileReader()
            reader.onloadend = () => setHoldPhotoPreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handleHoldWithPhoto = async () => {
        if (!holdPhoto) {
            alert('Mohon upload foto bukti penundaan')
            return
        }

        setUploadingPhoto(true)
        try {
            // Upload photo
            const formData = new FormData()
            formData.append('file', holdPhoto)
            formData.append('type', 'workorder-completion')
            formData.append('workOrderId', id)

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            if (!uploadRes.ok) {
                throw new Error('Gagal upload foto')
            }

            const uploadData = await uploadRes.json()

            // Hold the work order with attachment
            await performAction('hold', {
                attachmentUrl: uploadData.url,
                note: holdReason || 'Pekerjaan ditunda'
            })

            // Reset modal
            setShowHoldModal(false)
            setHoldPhoto(null)
            setHoldPhotoPreview(null)
            setHoldReason('')
        } catch (error: any) {
            console.error('Error holding with photo:', error)
            alert(error.message || 'Gagal menunda work order')
        } finally {
            setUploadingPhoto(false)
        }
    }

    // Note photo handlers
    const handleNotePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setNotePhoto(file)
            const reader = new FileReader()
            reader.onloadend = () => setNotePhotoPreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handleAddNoteWithPhoto = async () => {
        if (!noteText.trim()) {
            alert('Mohon isi catatan')
            return
        }

        setActionLoading(true)
        try {
            let attachmentUrl = null

            // Upload photo if provided
            if (notePhoto) {
                const formData = new FormData()
                formData.append('file', notePhoto)
                formData.append('type', 'workorder-completion')
                formData.append('workOrderId', id)

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData,
                })

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json()
                    attachmentUrl = uploadData.url
                }
            }

            // Add note with optional attachment
            await performAction('addNote', {
                note: noteText,
                attachmentUrl
            })

            // Reset
            setShowNoteForm(false)
            setNoteText('')
            setNotePhoto(null)
            setNotePhotoPreview(null)
        } catch (error: any) {
            console.error('Error adding note:', error)
            alert(error.message || 'Gagal menambah catatan')
        } finally {
            setActionLoading(false)
        }
    }

    const toggleTask = async (taskId: string, completed: boolean) => {
        try {
            const response = await fetch(`/api/employee/workorders/${id}/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed }),
            })
            if (response.ok) {
                await loadWorkOrder()
            }
        } catch (error) {
            console.error('Error toggling task:', error)
        }
    }

    const handleCall = (phone: string) => window.open(`tel:${phone}`, '_self')
    const handleMaps = (address: string) => {
        window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')
    }

    if (status === 'loading' || loading) {
        return <div className="min-h-screen flex items-center justify-center"><PageLoader /></div>
    }
    if (!workOrder) {
        return <div className="p-6 text-center text-gray-500">Work Order not found</div>
    }

    const customerName = workOrder.pelanggan?.nama || workOrder.contactName || 'Guest'
    const customerPhone = workOrder.pelanggan?.noTelp || workOrder.contactPhone
    const customerAddress = workOrder.locationAddress || workOrder.pelanggan?.alamat

    const isMyTicket = workOrder.assignedToId === employeeId
    const canClaim = workOrder.status === 'PENDING' && !workOrder.assignedToId
    const canRelease = isMyTicket && ['ASSIGNED', 'ON_HOLD'].includes(workOrder.status)
    const canStart = isMyTicket && workOrder.status === 'ASSIGNED'
    const canComplete = isMyTicket && workOrder.status === 'IN_PROGRESS'
    const canHold = isMyTicket && workOrder.status === 'IN_PROGRESS'
    const canResume = isMyTicket && workOrder.status === 'ON_HOLD'

    const completedTasks = workOrder.tasks?.filter(t => t.status === 'COMPLETED').length || 0
    const totalTasks = workOrder.tasks?.length || 0

    return (
        <>
            <div className="bg-gray-50 dark:bg-gray-900 min-h-screen pb-32">
                {/* Header */}
                <div className="bg-white dark:bg-gray-800 px-4 py-4 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-3">
                    <Link href="/employee/workorders" className="p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <HiArrowLeft className="w-6 h-6" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{workOrder.workOrderNumber}</h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {workOrder.site ? `Site: ${workOrder.site.code}` : 'Detail Pekerjaan'}
                        </p>
                    </div>
                    <div className={`px-3 py-1 text-xs font-bold rounded-full border ${STATUS_COLORS[workOrder.status]}`}>
                        {workOrder.status.replace('_', ' ')}
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* Main Info Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
                        <div className="mb-4">
                            <span className="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400 uppercase">{workOrder.type}</span>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{workOrder.title}</h2>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                            {workOrder.description}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium ${workOrder.priority === 'URGENT' || workOrder.priority === 'CRITICAL'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                <HiExclamationCircle className="w-4 h-4" />
                                {workOrder.priority}
                            </span>
                            {workOrder.scheduledDate && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-sm font-medium">
                                    <HiClock className="w-4 h-4" />
                                    {new Date(workOrder.scheduledDate).toLocaleDateString('id-ID')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Task Checklist */}
                    {workOrder.tasks && workOrder.tasks.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                                    <HiListBullet className="w-5 h-5" />
                                    Task Checklist
                                </h3>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {completedTasks}/{totalTasks} selesai
                                </span>
                            </div>
                            {/* Progress bar */}
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-300"
                                    style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                                />
                            </div>
                            <div className="space-y-3">
                                {workOrder.tasks.map((task) => (
                                    <label
                                        key={task.id}
                                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${task.status === 'COMPLETED'
                                            ? 'bg-green-50 dark:bg-green-900/20'
                                            : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={task.status === 'COMPLETED'}
                                            onChange={(e) => toggleTask(task.id, e.target.checked)}
                                            disabled={!isMyTicket || workOrder.status === 'COMPLETED'}
                                            className="w-5 h-5 mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                                        />
                                        <div className="flex-1">
                                            <p className={`font-medium ${task.status === 'COMPLETED'
                                                ? 'text-gray-500 dark:text-gray-400 line-through'
                                                : 'text-gray-900 dark:text-white'
                                                }`}>
                                                {task.title}
                                            </p>
                                            {task.description && (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{task.description}</p>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Customer & Location */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700 space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide border-b dark:border-gray-700 pb-2">Informasi Pelanggan</h3>
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 font-bold text-lg">
                                {customerName.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-gray-900 dark:text-white">{customerName}</h4>
                                {workOrder.pelanggan ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{workOrder.pelanggan.idPelanggan}</p>
                                ) : (
                                    <p className="text-sm text-orange-500 bg-orange-50 dark:bg-orange-900/30 inline-block px-1.5 rounded mt-0.5">Guest</p>
                                )}
                                {customerPhone && (
                                    <button
                                        onClick={() => handleCall(customerPhone)}
                                        className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                                    >
                                        <HiPhone className="w-4 h-4" />
                                        Hubungi
                                    </button>
                                )}
                            </div>
                        </div>
                        {customerAddress && (
                            <div className="pt-2">
                                <div className="flex gap-2 text-gray-700 dark:text-gray-300 mb-2">
                                    <HiMapPin className="w-5 h-5 text-gray-400 shrink-0" />
                                    <p className="text-sm">{customerAddress}</p>
                                </div>
                                <button
                                    onClick={() => handleMaps(customerAddress)}
                                    className="w-full py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center gap-2 text-sm"
                                >
                                    <HiMapPin className="w-4 h-4" />
                                    Buka di Maps
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Activity Timeline */}
                    {workOrder.updates && workOrder.updates.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-4">Aktivitas</h3>
                            <div className="space-y-3">
                                {workOrder.updates.slice(0, 5).map((update) => (
                                    <div key={update.id} className="flex gap-3 text-sm">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-gray-900 dark:text-white">{update.message}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                {update.createdBy?.fullName || 'System'} • {new Date(update.createdAt).toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add Note Form */}
                    {showNoteForm && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide mb-3">Tambah Catatan</h3>
                            <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Tulis catatan progress..."
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                            {/* Optional Photo */}
                            <div className="mt-3">
                                <label className="text-xs text-gray-500 mb-1 block">Foto (opsional)</label>
                                {notePhotoPreview ? (
                                    <div className="relative w-20 h-20">
                                        <img src={notePhotoPreview} alt="Preview" className="w-full h-full object-cover rounded-lg border" />
                                        <button
                                            onClick={() => { setNotePhoto(null); setNotePhotoPreview(null); }}
                                            className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full"
                                        >
                                            <HiXMark className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-500">
                                        <HiCamera className="w-4 h-4" />
                                        Tambah Foto
                                        <input type="file" accept="image/*" capture="environment" onChange={handleNotePhotoSelect} className="hidden" />
                                    </label>
                                )}
                            </div>
                            <div className="flex gap-3 mt-3">
                                <button
                                    onClick={() => { setShowNoteForm(false); setNotePhoto(null); setNotePhotoPreview(null); }}
                                    className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
                                >
                                    Batal
                                </button>
                                <button
                                    onClick={handleAddNoteWithPhoto}
                                    disabled={!noteText.trim() || actionLoading}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <HiPaperAirplane className="w-4 h-4" />
                                    Kirim
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons Footer */}
                <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="max-w-md mx-auto space-y-3">
                        {/* Main Actions */}
                        <div className="grid grid-cols-2 gap-3">
                            {canClaim && (
                                <button
                                    onClick={() => performAction('claim')}
                                    disabled={actionLoading}
                                    className="col-span-2 flex items-center justify-center gap-2 px-4 py-3.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 disabled:opacity-50"
                                >
                                    <HiHandRaised className="w-5 h-5" />
                                    Ambil Tiket
                                </button>
                            )}

                            {canStart && (
                                <button
                                    onClick={() => performAction('start')}
                                    disabled={actionLoading}
                                    className="col-span-2 flex items-center justify-center gap-2 px-4 py-3.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-lg disabled:opacity-50"
                                >
                                    <HiPlay className="w-5 h-5" />
                                    Mulai Kerjakan
                                </button>
                            )}

                            {canComplete && (
                                <>
                                    <button
                                        onClick={() => setShowHoldModal(true)}
                                        disabled={actionLoading}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/50 disabled:opacity-50"
                                    >
                                        <HiPause className="w-5 h-5" />
                                        Tunda
                                    </button>
                                    <button
                                        onClick={() => setShowCompleteModal(true)}
                                        disabled={actionLoading}
                                        className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg disabled:opacity-50"
                                    >
                                        <HiCheckCircle className="w-5 h-5" />
                                        Selesaikan
                                    </button>
                                </>
                            )}

                            {canResume && (
                                <button
                                    onClick={() => performAction('resume')}
                                    disabled={actionLoading}
                                    className="col-span-2 flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50"
                                >
                                    <HiPlay className="w-5 h-5" />
                                    Lanjutkan Kerja
                                </button>
                            )}

                            {workOrder.status === 'COMPLETED' && (
                                <div className="col-span-2 flex items-center justify-center gap-2 px-4 py-3.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold rounded-xl">
                                    <HiCheckCircle className="w-5 h-5" />
                                    Selesai - Menunggu Verifikasi
                                </div>
                            )}
                        </div>

                        {/* Secondary Actions */}
                        {isMyTicket && !['COMPLETED', 'VERIFIED'].includes(workOrder.status) && (
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setShowNoteForm(!showNoteForm)}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600"
                                >
                                    <HiChatBubbleLeftEllipsis className="w-5 h-5" />
                                    Catatan
                                </button>
                                {canRelease && (
                                    <button
                                        onClick={() => performAction('release')}
                                        disabled={actionLoading}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                                    >
                                        <HiArrowUturnLeft className="w-5 h-5" />
                                        Lepas Tiket
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Completion Photo Modal */}
            {showCompleteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Selesaikan Work Order
                            </h3>
                            <button
                                onClick={() => {
                                    setShowCompleteModal(false)
                                    setCompletionPhotos([])
                                    setCompletionPhotoPreviews([])
                                    setCompletionNote('')
                                }}
                                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                            >
                                <HiXMark className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 space-y-4">
                            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                                <p className="text-sm text-amber-800 dark:text-amber-200">
                                    📸 Upload 1-5 foto bukti penyelesaian untuk verifikasi admin.
                                </p>
                            </div>

                            {/* Photo Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Foto Bukti <span className="text-red-500">*</span>
                                    <span className="text-gray-400 ml-2">({completionPhotoPreviews.length}/{MAX_PHOTOS})</span>
                                </label>

                                {/* Photo Grid */}
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {completionPhotoPreviews.map((preview, index) => (
                                        <div key={index} className="relative aspect-square">
                                            <img
                                                src={preview}
                                                alt={`Preview ${index + 1}`}
                                                className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                                            />
                                            <button
                                                onClick={() => removePhoto(index)}
                                                className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md"
                                            >
                                                <HiXMark className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Add more photo button */}
                                    {completionPhotoPreviews.length < MAX_PHOTOS && (
                                        <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700">
                                            <HiCamera className="w-8 h-8 text-gray-400" />
                                            <span className="text-xs text-gray-400 mt-1">Tambah</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                multiple
                                                onChange={handlePhotoSelect}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Note */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Catatan Penyelesaian
                                </label>
                                <textarea
                                    value={completionNote}
                                    onChange={(e) => setCompletionNote(e.target.value)}
                                    placeholder="Tambahkan catatan jika diperlukan..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none text-sm"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                            <button
                                onClick={handleCompleteWithPhoto}
                                disabled={completionPhotos.length === 0 || uploadingPhoto}
                                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {uploadingPhoto ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Mengupload {completionPhotos.length} foto...
                                    </>
                                ) : (
                                    <>
                                        <HiCheckCircle className="w-5 h-5" />
                                        Selesai & Kirim {completionPhotos.length} Bukti
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setShowCompleteModal(false)
                                    setCompletionPhotos([])
                                    setCompletionPhotoPreviews([])
                                    setCompletionNote('')
                                }}
                                className="w-full py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hold Photo Modal */}
            {showHoldModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Tunda Pekerjaan
                            </h3>
                            <button
                                onClick={() => {
                                    setShowHoldModal(false)
                                    setHoldPhoto(null)
                                    setHoldPhotoPreview(null)
                                    setHoldReason('')
                                }}
                                className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                            >
                                <HiXMark className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 space-y-4">
                            <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                                <p className="text-sm text-orange-800 dark:text-orange-200">
                                    📷 Foto bukti kendala diperlukan untuk dokumentasi penundaan.
                                </p>
                            </div>

                            {/* Photo Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Foto Bukti Kendala <span className="text-red-500">*</span>
                                </label>
                                {holdPhotoPreview ? (
                                    <div className="relative">
                                        <img
                                            src={holdPhotoPreview}
                                            alt="Preview"
                                            className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                                        />
                                        <button
                                            onClick={() => {
                                                setHoldPhoto(null)
                                                setHoldPhotoPreview(null)
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"
                                        >
                                            <HiXMark className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700">
                                        <HiCamera className="w-10 h-10 text-gray-400 mb-1" />
                                        <span className="text-sm text-gray-500">Tap untuk foto</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            onChange={handleHoldPhotoSelect}
                                            className="hidden"
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Alasan Penundaan
                                </label>
                                <textarea
                                    value={holdReason}
                                    onChange={(e) => setHoldReason(e.target.value)}
                                    placeholder="Jelaskan alasan penundaan..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 resize-none text-sm"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                            <button
                                onClick={handleHoldWithPhoto}
                                disabled={!holdPhoto || uploadingPhoto}
                                className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {uploadingPhoto ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Mengupload...
                                    </>
                                ) : (
                                    <>
                                        <HiPause className="w-5 h-5" />
                                        Tunda Pekerjaan
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setShowHoldModal(false)
                                    setHoldPhoto(null)
                                    setHoldPhotoPreview(null)
                                    setHoldReason('')
                                }}
                                className="w-full py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
