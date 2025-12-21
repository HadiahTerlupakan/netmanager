'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
    HiArrowLeft,
    HiPaperAirplane,
    HiOutlineUser,
    HiOutlinePhone,
    HiOutlineEnvelope,
    HiOutlineMapPin,
    HiOutlineClock,
    HiOutlineTag,
    HiXMark,
    HiCheckCircle,
    HiCheck,
    HiPaperClip,
} from 'react-icons/hi2'
import {
    MdChat,
    MdSend,
    MdMoreVert,
    MdCheckCircle as MdCheckCircleOutline, // Renamed to avoid conflict with HiCheckCircle
    MdAssignment
} from 'react-icons/md'
import { formatDistanceToNow, format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useRealtimeTicketChat, type ChatReply } from '@/lib/websocket/hooks/useRealtimeTicketChat'

interface Reply {
    id: string
    message: string
    isFromAdmin: boolean
    createdAt: string
    sender?: {
        id: string
        name: string
        image?: string
    } | null
    attachments?: string[] | null
}

interface Ticket {
    id: string
    ticketNumber: string
    subject: string
    description: string
    status: string
    priority: string
    category: string
    createdAt: string
    updatedAt: string
    resolvedAt: string | null
    closedAt: string | null
    pelanggan: {
        id: string
        idPelanggan: string
        nama: string
        username: string
        email: string | null
        noTelp: string | null
        alamat: string | null
        status: string
        hargaPaket: { name: string } | null
    }
    assignedTo: {
        id: string
        name: string
        email: string
    } | null
    replies: Reply[]
}

export function ClientComponent() {
    const router = useRouter()
    const params = useParams()
    const ticketId = params.id as string

    const [ticket, setTicket] = useState<Ticket | null>(null)
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [status, setStatus] = useState('')
    const [showCloseModal, setShowCloseModal] = useState(false)
    const [closingNote, setClosingNote] = useState('')
    const [closing, setClosing] = useState(false)
    const [sendingClosingMsg, setSendingClosingMsg] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Attachment states
    const [attachments, setAttachments] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Real-time chat via WebSocket
    const { replies, isConnected, setReplies, addReply } = useRealtimeTicketChat({
        ticketId,
        initialReplies: ticket?.replies || [],
    })

    const loadTicket = useCallback(async (showLoading = false) => {
        if (showLoading) setLoading(true)
        try {
            const res = await fetch(`/api/admin/support-tickets/${ticketId}`)
            if (res.ok) {
                const data = await res.json()
                setTicket(data.ticket)
                setStatus(data.ticket.status)
                // Update replies for WebSocket hook
                setReplies(data.ticket.replies || [])
            }
        } catch (error) {
            console.error('Error loading ticket:', error)
        } finally {
            if (showLoading) setLoading(false)
        }
    }, [ticketId, setReplies])

    // Initial load only (no polling)
    useEffect(() => {
        loadTicket(true)
    }, [loadTicket])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [replies])

    const handleSendReply = async () => {
        if ((!message.trim() && attachments.length === 0) || sending) return

        const messageToSend = message.trim()
        const attachmentsToSend = [...attachments]

        setSending(true)
        setMessage('')
        setAttachments([])

        try {
            const res = await fetch(`/api/admin/support-tickets/${ticketId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageToSend,
                    updateStatus: status === 'OPEN' ? 'IN_PROGRESS' : undefined,
                    attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined
                }),
            })

            if (res.ok) {
                const data = await res.json()
                // Optimistic update - add the reply from API response immediately
                if (data.reply) {
                    addReply({
                        id: data.reply.id,
                        message: data.reply.message,
                        isFromAdmin: data.reply.isFromAdmin,
                        createdAt: data.reply.createdAt,
                        sender: data.reply.sender,
                        attachments: attachmentsToSend.length > 0 ? attachmentsToSend : null,
                    })
                }
            } else {
                // Restore message on error
                setMessage(messageToSend)
                setAttachments(attachmentsToSend)
            }
        } catch (error) {
            console.error('Error sending reply:', error)
            // Restore message on error
            setMessage(messageToSend)
            setAttachments(attachmentsToSend)
        } finally {
            setSending(false)
        }
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Basic validation
        if (file.size > 5 * 1024 * 1024) {
            alert('Ukuran file maksimal 5MB')
            return
        }

        if (!file.type.startsWith('image/')) {
            alert('Hanya file gambar yang diperbolehkan')
            return
        }

        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch('/api/uploads', {
                method: 'POST',
                body: formData,
            })

            if (res.ok) {
                const data = await res.json()
                setAttachments(prev => [...prev, data.url])
            } else {
                alert('Gagal mengupload gambar')
            }
        } catch (error) {
            console.error('Upload error:', error)
            alert('Terjadi kesalahan saat upload')
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const removeAttachment = (indexToRemove: number) => {
        setAttachments(prev => prev.filter((_, idx) => idx !== indexToRemove))
    }

    const handleStatusChange = async (newStatus: string) => {
        try {
            const res = await fetch(`/api/admin/support-tickets/${ticketId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })

            if (res.ok) {
                setStatus(newStatus)
                loadTicket()
            }
        } catch (error) {
            console.error('Error updating status:', error)
        }
    }

    const handleCloseTicket = async () => {
        setClosing(true)
        try {
            const res = await fetch(`/api/admin/support-tickets/${ticketId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'CLOSED',
                    closingNote: closingNote.trim() || undefined
                }),
            })

            if (res.ok) {
                setStatus('CLOSED')
                setShowCloseModal(false)
                loadTicket(false)
            }
        } catch (error) {
            console.error('Error closing ticket:', error)
        } finally {
            setClosing(false)
        }
    }

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'OPEN': return 'bg-red-100 text-red-700 border-red-200'
            case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
            case 'WAITING_CUSTOMER': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'RESOLVED': return 'bg-green-100 text-green-700 border-green-200'
            case 'CLOSED': return 'bg-gray-100 text-gray-700 border-gray-200'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    const getPriorityLabel = (priority: string) => {
        switch (priority) {
            case 'URGENT': return { label: 'Urgent', color: 'text-red-600' }
            case 'HIGH': return { label: 'Tinggi', color: 'text-orange-600' }
            case 'MEDIUM': return { label: 'Medium', color: 'text-yellow-600' }
            case 'LOW': return { label: 'Rendah', color: 'text-gray-600' }
            default: return { label: priority, color: 'text-gray-600' }
        }
    }

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case 'TECHNICAL': return 'Masalah Teknis'
            case 'BILLING': return 'Tagihan & Pembayaran'
            case 'ACCOUNT': return 'Akun'
            case 'OTHER': return 'Lainnya'
            default: return category
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!ticket) {
        return (
            <div className="p-6 text-center">
                <p className="text-gray-500">Tiket tidak ditemukan</p>
                <Link href="/admin/support" className="text-teal-600 hover:underline mt-2 inline-block">
                    Kembali ke daftar tiket
                </Link>
            </div>
        )
    }

    const priority = getPriorityLabel(ticket.priority)

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-950">
            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/admin/support')}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <HiArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                                {ticket.subject}
                            </h1>
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-gray-500 font-mono">#{ticket.ticketNumber}</p>
                                {isConnected && (
                                    <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded animate-pulse">
                                        Live
                                    </span>
                                )}
                            </div>
                        </div>
                        <select
                            value={status}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${getStatusColor(status)} focus:outline-none focus:ring-2 focus:ring-teal-500`}
                        >
                            <option value="OPEN">Baru</option>
                            <option value="IN_PROGRESS">Dalam Proses</option>
                            <option value="WAITING_CUSTOMER">Menunggu Pelanggan</option>
                            <option value="RESOLVED">Selesai</option>
                            <option value="CLOSED">Ditutup</option>
                        </select>
                        {status !== 'CLOSED' && (
                            <button
                                onClick={() => setShowCloseModal(true)}
                                className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Tutup Tiket"
                            >
                                <HiXMark className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Initial Ticket Message */}
                    <div className="flex justify-start">
                        <div className="max-w-[80%] bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                                {ticket.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                <span>{ticket.pelanggan.nama}</span>
                                <span>•</span>
                                <span>{format(new Date(ticket.createdAt), 'dd MMM yyyy HH:mm', { locale: id })}</span>
                            </div>
                        </div>
                    </div>

                    {/* Replies */}
                    {replies.map((reply) => (
                        <div
                            key={reply.id}
                            className={`flex ${reply.isFromAdmin ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${reply.isFromAdmin
                                    ? 'bg-teal-600 text-white rounded-tr-sm'
                                    : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-tl-sm'
                                    }`}
                            >
                                <p className={`text-sm whitespace-pre-wrap ${reply.isFromAdmin ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                    {reply.message}
                                </p>
                                <div className={`flex items-center gap-2 mt-2 text-xs ${reply.isFromAdmin ? 'text-teal-100' : 'text-gray-500'}`}>
                                    <span>{reply.isFromAdmin ? (reply.sender?.name || 'Admin') : ticket.pelanggan.nama}</span>
                                    <span>•</span>
                                    <span>{format(new Date(reply.createdAt), 'dd MMM HH:mm', { locale: id })}</span>
                                </div>
                                {/* Render Attachments */}
                                {reply.attachments && Array.isArray(reply.attachments) && reply.attachments.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {reply.attachments.map((url, idx) => (
                                            <a
                                                key={idx}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block rounded-lg overflow-hidden border border-black/10 dark:border-white/10"
                                            >
                                                <img
                                                    src={url}
                                                    alt="Lampiran"
                                                    className="w-full h-auto object-cover max-h-60"
                                                />
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Reply Input */}
                {ticket.status !== 'CLOSED' && (
                    <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
                        {/* Attachment Previews */}
                        {attachments.length > 0 && (
                            <div className="px-4 pt-4 flex gap-3 overflow-x-auto pb-2">
                                {attachments.map((url, idx) => (
                                    <div key={idx} className="relative w-20 h-20 shrink-0 group">
                                        <img
                                            src={url}
                                            alt="Preview"
                                            className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                                        />
                                        <button
                                            onClick={() => removeAttachment(idx)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                        >
                                            <HiXMark className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="p-4 flex gap-3 items-end">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileSelect}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading || sending}
                                className="p-3 text-gray-500 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors shrink-0"
                                title="Lampirkan Gambar"
                            >
                                <HiPaperClip className="w-5 h-5" />
                            </button>
                            <div className="flex-1 relative">
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Ketik balasan..."
                                    rows={1}
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y min-h-[46px] max-h-32"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleSendReply()
                                        }
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleSendReply}
                                disabled={(!message.trim() && attachments.length === 0) || sending || uploading}
                                className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shrink-0 h-[46px]"
                            >
                                {sending || uploading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <HiPaperAirplane className="w-5 h-5" />
                                        <span>Kirim</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Customer Info Sidebar */}
            <div className="w-full lg:w-80 bg-white dark:bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
                <div className="p-4 space-y-6">
                    {/* Customer Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informasi Pelanggan</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <HiOutlineUser className="w-4 h-4 text-gray-400" />
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{ticket.pelanggan.nama}</p>
                                    <p className="text-xs text-gray-500">{ticket.pelanggan.idPelanggan}</p>
                                </div>
                            </div>
                            {ticket.pelanggan.noTelp && (
                                <div className="flex items-center gap-3">
                                    <HiOutlinePhone className="w-4 h-4 text-gray-400" />
                                    <a href={`tel:${ticket.pelanggan.noTelp}`} className="text-sm text-teal-600 hover:underline">
                                        {ticket.pelanggan.noTelp}
                                    </a>
                                </div>
                            )}
                            {ticket.pelanggan.email && (
                                <div className="flex items-center gap-3">
                                    <HiOutlineEnvelope className="w-4 h-4 text-gray-400" />
                                    <a href={`mailto:${ticket.pelanggan.email}`} className="text-sm text-teal-600 hover:underline truncate">
                                        {ticket.pelanggan.email}
                                    </a>
                                </div>
                            )}
                            {ticket.pelanggan.alamat && (
                                <div className="flex items-start gap-3">
                                    <HiOutlineMapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{ticket.pelanggan.alamat}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <hr className="border-gray-100 dark:border-gray-800" />

                    {/* Ticket Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Detail Tiket</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Prioritas</span>
                                <span className={`text-sm font-medium ${priority.color}`}>{priority.label}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Kategori</span>
                                <span className="text-sm text-gray-900 dark:text-white">{getCategoryLabel(ticket.category)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Paket</span>
                                <span className="text-sm text-gray-900 dark:text-white">{ticket.pelanggan.hargaPaket?.name || '-'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Dibuat</span>
                                <span className="text-sm text-gray-900 dark:text-white">
                                    {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: id })}
                                </span>
                            </div>
                            {ticket.assignedTo && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Ditugaskan</span>
                                    <span className="text-sm text-gray-900 dark:text-white">{ticket.assignedTo.name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <hr className="border-gray-100 dark:border-gray-800" />

                    {/* Quick Actions */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Aksi Cepat</h3>
                        <div className="space-y-2">
                            <Link
                                href={`/admin/pelanggan/ppp/${ticket.pelanggan.id}`}
                                className="block w-full px-4 py-2 text-sm text-center bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                Lihat Profil Pelanggan
                            </Link>
                            <button
                                onClick={() => {
                                    const params = new URLSearchParams({
                                        ticketId: ticket.id,
                                        pelangganId: ticket.pelanggan.id,
                                        title: `[TIKET-${ticket.ticketNumber}] ${ticket.subject}`,
                                        description: ticket.description,
                                        priority: ticket.priority,
                                    })
                                    router.push(`/admin/workorders/new?${params.toString()}`)
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors border border-indigo-200 dark:border-indigo-800"
                            >
                                <MdAssignment className="text-xl" />
                                Buat Work Order
                            </button>
                            {/* Send Closing Message Button */}
                            {status !== 'CLOSED' && (
                                <button
                                    onClick={async () => {
                                        setSendingClosingMsg(true)
                                        try {
                                            const closingMessage = `Hai ${ticket.pelanggan.nama} 👋\n\nTerima kasih telah menghubungi kami. Jika masalah Anda sudah teratasi dan tidak ada kendala lagi, silakan tutup tiket ini dengan menekan tombol "Tutup Tiket" di halaman detail tiket.\n\nJika masih ada kendala, silakan balas pesan ini. Kami siap membantu! 🙏`
                                            const res = await fetch(`/api/admin/support-tickets/${ticketId}/reply`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ message: closingMessage }),
                                            })
                                            if (res.ok) {
                                                await handleStatusChange('RESOLVED')
                                                loadTicket(false)
                                            }
                                        } catch (error) {
                                            console.error('Error sending closing message:', error)
                                        } finally {
                                            setSendingClosingMsg(false)
                                        }
                                    }}
                                    disabled={sendingClosingMsg}
                                    className="block w-full px-4 py-2 text-sm text-center bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors border border-teal-200 dark:border-teal-800 disabled:opacity-50"
                                >
                                    {sendingClosingMsg ? 'Mengirim...' : '📩 Kirim Pesan Penutup'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Close Ticket Modal */}
            {showCloseModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                                <HiXMark className="w-5 h-5 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Tutup Tiket?
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Setelah ditutup, pelanggan tidak dapat membalas lagi. Pastikan masalah sudah terselesaikan.
                        </p>
                        <textarea
                            value={closingNote}
                            onChange={(e) => setClosingNote(e.target.value)}
                            placeholder="Catatan penutup (opsional)..."
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowCloseModal(false)}
                                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleCloseTicket}
                                disabled={closing}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
                            >
                                {closing ? 'Menutup...' : 'Tutup Tiket'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
