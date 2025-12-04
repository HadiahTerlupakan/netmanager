"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
    HiArrowLeft,
    HiPaperAirplane,
    HiUserCircle,
    HiPencil,
    HiCheck,
    HiWrenchScrewdriver,
    HiXMark,
} from 'react-icons/hi2'
import { TicketStatusBadge } from '@/components/helpdesk/TicketStatusBadge'
import { TicketPriorityBadge } from '@/components/helpdesk/TicketPriorityBadge'
import { TicketTimeline } from '@/components/helpdesk/TicketTimeline'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import PageLoader from '@/components/ui/PageLoader'

type TicketDetail = {
    id: string
    ticketNumber: string
    subject: string
    description: string
    status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
    assignedToId: string | null
    category?: {
        id: string
        name: string
        color?: string
    } | null
    createdAt: string
    firstResponseAt: string | null
    resolvedAt: string | null
    closedAt: string | null
    messages?: any[]
    pelanggan: {
        id: string
        idPelanggan: string
        nama: string
        email: string | null
        noTelp: string | null
    }
}

export default function AdminTicketDetailPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const params = useParams()
    const ticketId = params?.id as string

    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [ticket, setTicket] = useState<TicketDetail | null>(null)
    const [reply, setReply] = useState('')
    const [isInternal, setIsInternal] = useState(false)
    const [editMode, setEditMode] = useState<string | null>(null)
    const [editValues, setEditValues] = useState({
        status: '',
        priority: '',
        assignedToId: '',
    })
    const [showConvertModal, setShowConvertModal] = useState(false)
    const [converting, setConverting] = useState(false)
    const [convertData, setConvertData] = useState({
        type: 'TROUBLESHOOT',
        scheduledDate: '',
        scheduledTimeStart: '',
        scheduledTimeEnd: '',
    })

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }

        if (session?.user && status === 'authenticated') {
            fetchTicketDetail()
        }
    }, [session, status, router, ticketId])

    const fetchTicketDetail = async () => {
        try {
            const response = await fetch(`/api/admin/helpdesk/tickets/${ticketId}`)

            if (response.ok) {
                const result = await response.json()
                setTicket(result.data)
                setEditValues({
                    status: result.data.status,
                    priority: result.data.priority,
                    assignedToId: result.data.assignedToId || '',
                })
            } else if (response.status === 404) {
                alert('Tiket tidak ditemukan')
                router.push('/admin/helpdesk/tiket')
            }
        } catch (error) {
            console.error('Error fetching ticket:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleConvertToWorkOrder = async () => {
        setConverting(true)
        try {
            const response = await fetch('/api/admin/workorders/convert-ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: ticket?.id,
                    type: convertData.type,
                    scheduledDate: convertData.scheduledDate || undefined,
                    scheduledTimeStart: convertData.scheduledTimeStart || undefined,
                    scheduledTimeEnd: convertData.scheduledTimeEnd || undefined,
                }),
            })

            if (response.ok) {
                const result = await response.json()
                const workOrderNumber = result.data?.workOrderNumber || 'N/A'
                alert(`Work Order ${workOrderNumber} berhasil dibuat!\n\nStatus tiket telah diubah menjadi "Sedang Dikerjakan" dan pesan otomatis telah ditambahkan ke tiket.`)
                setShowConvertModal(false)
                // Refresh ticket to show updated status and new message
                await fetchTicketDetail()
                // Small delay before redirect to let user see the update
                setTimeout(() => {
                    router.push(`/admin/workorders/${result.data.id}`)
                }, 500)
            } else {
                const error = await response.json()
                alert(`Error: ${error.error || 'Failed to convert'}`)
            }
        } catch (error) {
            console.error('Error converting:', error)
            alert('An error occurred')
        } finally {
            setConverting(false)
        }
    }

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!reply.trim()) {
            return
        }

        setSending(true)

        try {
            const response = await fetch(`/api/admin/helpdesk/tickets/${ticketId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: reply,
                    isInternal,
                }),
            })

            if (response.ok) {
                setReply('')
                setIsInternal(false)
                fetchTicketDetail()
            } else {
                const error = await response.json()
                alert(`Error: ${error.error || 'Gagal mengirim pesan'}`)
            }
        } catch (error) {
            console.error('Error sending reply:', error)
            alert('Terjadi kesalahan. Silakan coba lagi.')
        } finally {
            setSending(false)
        }
    }

    const handleUpdateField = async (field: string) => {
        try {
            const response = await fetch(`/api/admin/helpdesk/tickets/${ticketId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    [field]: editValues[field as keyof typeof editValues] || null
                }),
            })

            if (response.ok) {
                setEditMode(null)
                fetchTicketDetail()
            } else {
                const error = await response.json()
                alert(`Error: ${error.error || 'Gagal update tiket'}`)
            }
        } catch (error) {
            console.error('Error updating ticket:', error)
            alert('Gagal update tiket')
        }
    }

    if (loading) {
        return <PageLoader />
    }

    if (!ticket) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Tiket tidak ditemukan</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/helpdesk/tiket"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <HiArrowLeft className="w-6 h-6" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">{ticket.ticketNumber}</h1>
                    <p className="text-gray-600 mt-1">{ticket.subject}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Ticket Info */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-2">{ticket.subject}</h2>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {editMode === 'status' ? (
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={editValues.status}
                                                onChange={(e) => setEditValues({ ...editValues, status: e.target.value })}
                                                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                                            >
                                                <option value="OPEN">Baru</option>
                                                <option value="IN_PROGRESS">Sedang Ditangani</option>
                                                <option value="WAITING_CUSTOMER">Menunggu Respon</option>
                                                <option value="RESOLVED">Selesai</option>
                                                <option value="CLOSED">Ditutup</option>
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
                                            <TicketStatusBadge status={ticket.status} />
                                            <HiPencil className="w-3 h-3 text-gray-400" />
                                        </button>
                                    )}

                                    {editMode === 'priority' ? (
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={editValues.priority}
                                                onChange={(e) => setEditValues({ ...editValues, priority: e.target.value })}
                                                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                                            >
                                                <option value="LOW">Rendah</option>
                                                <option value="NORMAL">Normal</option>
                                                <option value="HIGH">Tinggi</option>
                                                <option value="URGENT">Mendesak</option>
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
                                            <TicketPriorityBadge priority={ticket.priority} />
                                            <HiPencil className="w-3 h-3 text-gray-400" />
                                        </button>
                                    )}

                                    {ticket.category && (
                                        <span
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                                            style={{
                                                backgroundColor: ticket.category.color + '20',
                                                borderColor: ticket.category.color + '40',
                                                color: ticket.category.color,
                                            }}
                                        >
                                            {ticket.category.name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="text-sm text-gray-600 space-y-1">
                            <p>
                                <span className="font-medium">Dibuat:</span>{' '}
                                {format(new Date(ticket.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId })}
                            </p>
                            {ticket.firstResponseAt && (
                                <p>
                                    <span className="font-medium">First Response:</span>{' '}
                                    {format(new Date(ticket.firstResponseAt), 'dd MMM yyyy HH:mm', { locale: localeId })}
                                </p>
                            )}
                            {ticket.resolvedAt && (
                                <p>
                                    <span className="font-medium">Diselesaikan:</span>{' '}
                                    {format(new Date(ticket.resolvedAt), 'dd MMM yyyy HH:mm', { locale: localeId })}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Conversation */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Percakapan</h3>
                        <TicketTimeline messages={ticket.messages || []} />
                    </div>

                    {/* Reply Form */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 mb-3">Balas Tiket</h3>
                        <form onSubmit={handleSendReply} className="space-y-3">
                            <textarea
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                placeholder="Tulis balasan Anda..."
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                                disabled={sending}
                            />
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={isInternal}
                                        onChange={(e) => setIsInternal(e.target.checked)}
                                        className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                                    />
                                    <span className="text-sm text-gray-700">Internal Note (tidak terlihat oleh customer)</span>
                                </label>
                                <button
                                    type="submit"
                                    disabled={sending || !reply.trim()}
                                    className={`px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${isInternal
                                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                        : 'bg-sky-500 hover:bg-sky-600 text-white'
                                        } disabled:bg-gray-400 disabled:cursor-not-allowed`}
                                >
                                    <HiPaperAirplane className="w-5 h-5" />
                                    <span>{sending ? 'Mengirim...' : isInternal ? 'Tambah Note' : 'Kirim Balasan'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Customer Info */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <HiUserCircle className="w-5 h-5" />
                            <span>Info Pelanggan</span>
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div>
                                <p className="text-gray-600">Nama</p>
                                <p className="font-medium text-gray-900">{ticket.pelanggan.nama}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">ID Pelanggan</p>
                                <p className="font-medium text-gray-900">{ticket.pelanggan.idPelanggan}</p>
                            </div>
                            {ticket.pelanggan.email && (
                                <div>
                                    <p className="text-gray-600">Email</p>
                                    <p className="font-medium text-gray-900">{ticket.pelanggan.email}</p>
                                </div>
                            )}
                            {ticket.pelanggan.noTelp && (
                                <div>
                                    <p className="text-gray-600">No. Telepon</p>
                                    <p className="font-medium text-gray-900">{ticket.pelanggan.noTelp}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Assignment */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Penugasan</h3>
                        {editMode === 'assignedToId' ? (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    value={editValues.assignedToId}
                                    onChange={(e) => setEditValues({ ...editValues, assignedToId: e.target.value })}
                                    placeholder="User ID staff"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleUpdateField('assignedToId')}
                                        className="flex-1 px-4 py-2 bg-sky-500 text-white rounded-lg text-sm hover:bg-sky-600"
                                    >
                                        Simpan
                                    </button>
                                    <button
                                        onClick={() => setEditMode(null)}
                                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                                    >
                                        Batal
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                {ticket.assignedToId ? (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600">Ditugaskan ke:</p>
                                            <p className="font-medium text-gray-900">{ticket.assignedToId}</p>
                                        </div>
                                        <button
                                            onClick={() => setEditMode('assignedToId')}
                                            className="p-2 hover:bg-gray-100 rounded-lg"
                                        >
                                            <HiPencil className="w-4 h-4 text-gray-400" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setEditMode('assignedToId')}
                                        className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-sky-500 hover:text-sky-600 transition-colors"
                                    >
                                        Assign ke Staff
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Convert to Work Order */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Work Order</h3>
                        <button
                            onClick={() => setShowConvertModal(true)}
                            className="w-full px-4 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg hover:from-sky-600 hover:to-blue-700 transition-all shadow-md flex items-center justify-center gap-2 font-medium"
                        >
                            <HiWrenchScrewdriver className="w-5 h-5" />
                            <span>Convert to Work Order</span>
                        </button>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            Create field work order dari ticket ini
                        </p>
                    </div>
                </div>
            </div>

            {/* Convert Modal */}
            {showConvertModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Convert to Work Order</h3>
                            <button
                                onClick={() => setShowConvertModal(false)}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <HiXMark className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Work Order Type *
                                </label>
                                <select
                                    value={convertData.type}
                                    onChange={(e) => setConvertData({ ...convertData, type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                >
                                    <option value="TROUBLESHOOT">Troubleshoot</option>
                                    <option value="INSTALLATION">Installation</option>
                                    <option value="MAINTENANCE">Maintenance</option>
                                    <option value="UPGRADE">Upgrade</option>
                                    <option value="RELOCATION">Relocation</option>
                                    <option value="DISCONNECTION">Disconnection</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Scheduled Date (Optional)
                                </label>
                                <input
                                    type="date"
                                    value={convertData.scheduledDate}
                                    onChange={(e) => setConvertData({ ...convertData, scheduledDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={convertData.scheduledTimeStart}
                                        onChange={(e) => setConvertData({ ...convertData, scheduledTimeStart: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        End Time
                                    </label>
                                    <input
                                        type="time"
                                        value={convertData.scheduledTimeEnd}
                                        onChange={(e) => setConvertData({ ...convertData, scheduledTimeEnd: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-sm text-blue-800">
                                    <strong>Info:</strong> Work order akan dibuat dengan data dari ticket ini:
                                </p>
                                <ul className="text-xs text-blue-700 mt-2 space-y-1">
                                    <li>• Title: {ticket?.subject}</li>
                                    <li>• Customer: {ticket?.pelanggan.nama}</li>
                                    <li>• Priority: {ticket?.priority}</li>
                                </ul>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowConvertModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                    disabled={converting}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConvertToWorkOrder}
                                    disabled={converting}
                                    className="flex-1 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {converting ? (
                                        <span>Converting...</span>
                                    ) : (
                                        <>
                                            <HiWrenchScrewdriver className="w-4 h-4" />
                                            <span>Create Work Order</span>
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
