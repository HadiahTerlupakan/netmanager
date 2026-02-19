'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/components/customer/CustomerAuthProvider'
import { Button } from '@/components/ui/Button'
import {
    MdArrowBack,
    MdSend,
    MdInfo,
    MdClose,
    MdStar,
    MdStarOutline,
    MdAttachFile,
} from 'react-icons/md'
import Image from 'next/image'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { useRealtimeTicketChat } from '@/lib/websocket/hooks/useRealtimeTicketChat'

interface Reply {
    id: string
    message: string
    isFromAdmin: boolean
    createdAt: string
    sender?: {
        id: string
        name: string
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
    replies: Reply[]
}

export default function TicketDetailPage() {
    const { isLoading: authLoading, isAuthenticated, customer } = useCustomerAuth()
    const router = useRouter()
    const params = useParams()
    const ticketId = params.id as string

    const [ticket, setTicket] = useState<Ticket | null>(null)
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [showCloseModal, setShowCloseModal] = useState(false)
    const [closingFeedback, setClosingFeedback] = useState('')
    const [closing, setClosing] = useState(false)
    const [rating, setRating] = useState(0)
    const [hoverRating, setHoverRating] = useState(0)
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
            const res = await fetch(`/api/customer/tickets/${ticketId}`)
            if (res.ok) {
                const data = await res.json()
                setTicket(data.ticket)
                // Update replies for WebSocket hook
                setReplies(data.ticket.replies || [])
            }
        } catch (error) {
            console.error('Error loading ticket:', error)
        } finally {
            if (showLoading) setLoading(false)
        }
    }, [ticketId, setReplies])

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
            return
        }
        if (isAuthenticated) {
            loadTicket(true)
        }
    }, [authLoading, isAuthenticated, router, loadTicket])

    // Scroll to bottom when replies change
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
            const res = await fetch(`/api/customer/tickets/${ticketId}/reply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageToSend,
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
                        sender: customer ? { id: customer.id, name: customer.nama } : null,
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

    const handleCloseTicket = async () => {
        setClosing(true)
        try {
            const res = await fetch(`/api/customer/tickets/${ticketId}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feedback: closingFeedback,
                    rating: rating > 0 ? rating : undefined
                }),
            })

            if (res.ok) {
                setShowCloseModal(false)
                loadTicket(false)
            }
        } catch (error) {
            console.error('Error closing ticket:', error)
        } finally {
            setClosing(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OPEN': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            case 'WAITING_CUSTOMER': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            case 'RESOLVED': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            case 'CLOSED': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'OPEN': return 'Menunggu'
            case 'IN_PROGRESS': return 'Diproses'
            case 'WAITING_CUSTOMER': return 'Perlu Balasan Anda'
            case 'RESOLVED': return 'Selesai Dikerjakan'
            case 'CLOSED': return 'Ditutup'
            default: return status
        }
    }

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case 'TECHNICAL': return 'Masalah Teknis'
            case 'BILLING': return 'Tagihan'
            case 'ACCOUNT': return 'Akun'
            case 'OTHER': return 'Lainnya'
            default: return category
        }
    }

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!ticket) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922] p-4">
                <p className="text-gray-500 dark:text-gray-400 mb-4">Tiket tidak ditemukan</p>
                <Link href="/dukungan/riwayat" className="text-[#0d9488] hover:underline">
                    Kembali ke riwayat
                </Link>
            </div>
        )
    }

    return (
        <div className="bg-[#f6f7f8] dark:bg-[#101922] font-sans antialiased text-[#111418] dark:text-white min-h-screen">
            <div className="relative flex h-screen w-full flex-col overflow-hidden max-w-md mx-auto bg-white dark:bg-[#101922] shadow-2xl">

                {/* TopAppBar */}
                <div className="sticky top-0 z-50 bg-white dark:bg-[#1C2630] border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center p-4 pb-2 justify-between">
                        <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            onClick={() => router.back()}
                        >
                            <MdArrowBack className="text-2xl" />
                        </Button>
                        <div className="flex-1 text-center">
                            <h2 className="text-[#111418] dark:text-white text-base font-bold leading-tight truncate">
                                {ticket.subject}
                            </h2>
                            <div className="flex items-center justify-center gap-2">
                                <p className="text-xs text-gray-500 font-mono">#{ticket.ticketNumber}</p>
                                {isConnected && (
                                    <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded animate-pulse">
                                        Live
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="w-10"></div>
                    </div>

                    {/* Ticket Info Bar */}
                    <div className="px-4 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(ticket.status)}`}>
                                {getStatusLabel(ticket.status)}
                            </span>
                            <span className="text-xs text-gray-500">{getCategoryLabel(ticket.category)}</span>
                        </div>
                        {/* Close Ticket Button - only show if not closed */}
                        {ticket.status !== 'CLOSED' && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowCloseModal(true)}
                                className="text-gray-500 hover:text-red-500"
                            >
                                <MdClose className="text-sm" />
                                Tutup Tiket
                            </Button>
                        )}
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Initial Ticket Message */}
                    <div className="flex justify-end">
                        <div className="max-w-[85%] bg-[#0d9488] text-white rounded-2xl rounded-tr-sm p-3 shadow-sm">
                            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
                            <p className="text-[10px] text-teal-100 mt-2 text-right">
                                {format(new Date(ticket.createdAt), 'dd MMM HH:mm', { locale: id })}
                            </p>
                        </div>
                    </div>

                    {/* Replies */}
                    {replies.map((reply) => {
                        // Check if this is a closing prompt message
                        const isClosingPrompt = reply.isFromAdmin &&
                            reply.message.includes('tutup tiket') &&
                            (reply.message.includes('tidak ada kendala') || reply.message.includes('sudah teratasi'))

                        return (
                            <div
                                key={reply.id}
                                className={`flex ${reply.isFromAdmin ? 'justify-start' : 'justify-end'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl shadow-sm ${reply.isFromAdmin
                                        ? 'bg-gray-100 dark:bg-gray-800 rounded-tl-sm'
                                        : 'bg-[#0d9488] text-white rounded-tr-sm'
                                        }`}
                                >
                                    <div className="p-3">
                                        {reply.isFromAdmin && (
                                            <p className="text-[10px] font-semibold text-[#0d9488] dark:text-teal-400 mb-1">
                                                {reply.sender?.name || 'Tim Dukungan'}
                                            </p>
                                        )}
                                        <p className={`text-sm whitespace-pre-wrap ${reply.isFromAdmin ? 'text-gray-900 dark:text-white' : 'text-white'}`}>
                                            {reply.message}
                                        </p>
                                        <p className={`text-[10px] mt-2 text-right ${reply.isFromAdmin ? 'text-gray-500' : 'text-teal-100'}`}>
                                            {format(new Date(reply.createdAt), 'dd MMM HH:mm', { locale: id })}
                                        </p>

                                        {/* Render Attachments */}
                                        {reply.attachments && Array.isArray(reply.attachments) && reply.attachments.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {reply.attachments.map((url, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block rounded-lg overflow-hidden border border-black/10 dark:border-white/10 relative w-full h-60"
                                                    >
                                                        <Image
                                                            src={url}
                                                            alt="Lampiran"
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Interactive Button for Closing Prompt */}
                                    {isClosingPrompt && ticket.status !== 'CLOSED' && (
                                        <div className="border-t border-gray-200 dark:border-gray-700">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setShowCloseModal(true)}
                                            className="w-full text-[#0d9488] dark:text-teal-400 rounded-b-2xl"
                                        >
                                            Tutup Tiket
                                        </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Reply Input or Closed Message */}
                {ticket.status === 'CLOSED' ? (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <MdInfo className="text-lg" />
                            <p className="text-sm">Tiket ini sudah ditutup</p>
                        </div>
                    </div>
                ) : (

                    <div className="bg-white dark:bg-[#1C2630] border-t border-gray-100 dark:border-gray-800">
                        {/* Attachment Previews */}
                        {
                            attachments.length > 0 && (
                                <div className="px-4 pt-4 flex gap-3 overflow-x-auto pb-2">
                                    {attachments.map((url, idx) => (
                                        <div key={idx} className="relative w-20 h-20 shrink-0 group">
                                            <Image
                                                src={url}
                                                alt="Preview"
                                                fill
                                                className="object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                                            />
                                            <Button
                                                variant="destructive"
                                                size="icon-sm"
                                                onClick={() => removeAttachment(idx)}
                                                className="absolute -top-2 -right-2 shadow-md"
                                            >
                                                <MdClose size={14} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )
                        }

                        <div className="p-4 flex gap-3 items-end">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileSelect}
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading || sending}
                                title="Lampirkan Gambar"
                            >
                                <MdAttachFile className="text-2xl" />
                            </Button>
                            <div className="flex-1 relative">
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Ketik balasan..."
                                    rows={1}
                                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0d9488]/50 resize-y min-h-[46px] max-h-32"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleSendReply()
                                        }
                                    }}
                                />
                            </div>
                            <Button
                                size="icon"
                                onClick={handleSendReply}
                                disabled={(!message.trim() && attachments.length === 0) || sending || uploading}
                                loading={sending || uploading}
                            >
                                <MdSend className="text-xl ml-0.5" />
                            </Button>
                        </div>
                    </div>
                )}


                {/* Close Ticket Modal */}
                {showCloseModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                Tutup Tiket?
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Apakah masalah Anda sudah teratasi? Setelah ditutup, tiket tidak dapat dibuka kembali.
                            </p>

                            {/* Star Rating */}
                            <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Bagaimana penilaian Anda terhadap layanan kami?
                                </p>
                                <div className="flex items-center justify-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            key={star}
                                            type="button"
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoverRating(star)}
                                            onMouseLeave={() => setHoverRating(0)}
                                            className="hover:scale-110"
                                        >
                                            {(hoverRating || rating) >= star ? (
                                                <MdStar className="w-8 h-8 text-yellow-400" />
                                            ) : (
                                                <MdStarOutline className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                                            )}
                                        </Button>
                                    ))}
                                </div>
                                {rating > 0 && (
                                    <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        {rating === 1 && 'Tidak Puas'}
                                        {rating === 2 && 'Kurang Puas'}
                                        {rating === 3 && 'Cukup Puas'}
                                        {rating === 4 && 'Puas'}
                                        {rating === 5 && 'Sangat Puas'}
                                    </p>
                                )}
                            </div>

                            <textarea
                                value={closingFeedback}
                                onChange={(e) => setClosingFeedback(e.target.value)}
                                placeholder="Tulis feedback atau komentar (opsional)..."
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-[#0d9488]/50 mb-4"
                            />
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowCloseModal(false)
                                        setRating(0)
                                        setHoverRating(0)
                                    }}
                                    className="flex-1"
                                >
                                    Batal
                                </Button>
                                <Button
                                    onClick={handleCloseTicket}
                                    disabled={closing}
                                    loading={closing}
                                    className="flex-1"
                                >
                                    Ya, Tutup
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
