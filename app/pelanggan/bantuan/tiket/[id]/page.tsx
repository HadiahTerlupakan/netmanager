"use client"

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
    HiArrowLeft,
    HiOutlineHome,
    HiOutlineDocumentText,
    HiOutlineUser,
    HiOutlineInformationCircle,
    HiPaperAirplane,
} from 'react-icons/hi2'
import { TicketStatusBadge } from '@/components/helpdesk/TicketStatusBadge'
import { TicketPriorityBadge } from '@/components/helpdesk/TicketPriorityBadge'
import { TicketTimeline } from '@/components/helpdesk/TicketTimeline'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

type TicketDetail = {
    id: string
    ticketNumber: string
    subject: string
    description: string
    status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
    category?: {
        name: string
        color?: string
    } | null
    createdAt: string
    messages?: any[]
    pelanggan: {
        id: string
        nama: string
    }
}

export default function TiketDetailPage() {
    const router = useRouter()
    const params = useParams()
    const ticketId = params?.id as string

    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [ticket, setTicket] = useState<TicketDetail | null>(null)
    const [reply, setReply] = useState('')

    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('pelanggan_token')
            const pelangganData = localStorage.getItem('pelanggan_data')

            if (!token || !pelangganData) {
                router.push('/pelanggan/login')
                return
            }

            fetchTicketDetail()
        }

        checkAuth()
    }, [router, ticketId])

    const fetchTicketDetail = async () => {
        try {
            const pelangganData = JSON.parse(localStorage.getItem('pelanggan_data') || '{}')

            const response = await fetch(`/api/pelanggan/tickets/${ticketId}`, {
                headers: {
                    'pelanggan-data': JSON.stringify(pelangganData),
                },
            })

            if (response.ok) {
                const result = await response.json()
                setTicket(result.data)
            } else if (response.status === 404) {
                alert('Tiket tidak ditemukan')
                router.push('/pelanggan/bantuan/tiket')
            } else if (response.status === 403) {
                alert('Anda tidak memiliki akses ke tiket ini')
                router.push('/pelanggan/bantuan/tiket')
            }
        } catch (error) {
            console.error('Error fetching ticket:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!reply.trim()) {
            return
        }

        setSending(true)

        try {
            const pelangganData = JSON.parse(localStorage.getItem('pelanggan_data') || '{}')

            const response = await fetch(`/api/pelanggan/tickets/${ticketId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'pelanggan-data': JSON.stringify(pelangganData),
                },
                body: JSON.stringify({ message: reply }),
            })

            if (response.ok) {
                setReply('')
                fetchTicketDetail() // Refresh to show new message
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

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-500">Memuat data...</div>
            </div>
        )
    }

    if (!ticket) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-500">Tiket tidak ditemukan</div>
            </div>
        )
    }

    const canReply = ticket.status !== 'CLOSED'

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
            {/* Header */}
            <header className="bg-gradient-to-r from-sky-400 to-cyan-500 text-white shadow-lg">
                <div className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/pelanggan/bantuan/tiket"
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                        >
                            <HiArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl font-bold truncate">{ticket.ticketNumber}</h1>
                            <p className="text-sm text-sky-100 truncate">{ticket.subject}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-4 py-4">
                {/* Ticket Info */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                        <TicketStatusBadge status={ticket.status} />
                        <TicketPriorityBadge priority={ticket.priority} />
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

                    <h2 className="text-lg font-semibold text-gray-900 mb-2">{ticket.subject}</h2>

                    <div className="text-sm text-gray-600 space-y-1">
                        <p>
                            <span className="font-medium">Dibuat:</span>{' '}
                            {format(new Date(ticket.createdAt), 'dd MMM yyyy HH:mm', { locale: localeId })}
                        </p>
                    </div>
                </div>

                {/* Status Messages */}
                {ticket.status === 'RESOLVED' && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-green-800">
                            <strong>Tiket ini telah diselesaikan.</strong> Jika masalah masih berlanjut, Anda
                            dapat mengirim pesan tambahan.
                        </p>
                    </div>
                )}

                {ticket.status === 'CLOSED' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-gray-800">
                            <strong>Tiket ini telah ditutup.</strong> Untuk masalah baru, silakan buat tiket
                            baru.
                        </p>
                    </div>
                )}

                {/* Conversation Timeline */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                    <h3 className="font-semibold text-gray-900 mb-4">Percakapan</h3>
                    <TicketTimeline messages={ticket.messages || []} />
                </div>

                {/* Reply Form */}
                {canReply && (
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Kirim Pesan</h3>
                        <form onSubmit={handleSendReply} className="space-y-3">
                            <textarea
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                placeholder="Tulis pesan Anda..."
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                                disabled={sending}
                            />
                            <button
                                type="submit"
                                disabled={sending || !reply.trim()}
                                className="w-full bg-sky-500 text-white py-3 rounded-lg font-semibold hover:bg-sky-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2"
                            >
                                <HiPaperAirplane className="w-5 h-5" />
                                <span>{sending ? 'Mengirim...' : 'Kirim Pesan'}</span>
                            </button>
                        </form>
                    </div>
                )}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg md:hidden">
                <div className="flex items-center justify-around h-16">
                    <Link
                        href="/pelanggan"
                        className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
                    >
                        <HiOutlineHome className="w-6 h-6" />
                        <span className="text-xs font-medium">Beranda</span>
                    </Link>
                    <Link
                        href="/pelanggan/tagihan"
                        className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
                    >
                        <HiOutlineDocumentText className="w-6 h-6" />
                        <span className="text-xs font-medium">Tagihan</span>
                    </Link>
                    <Link
                        href="/pelanggan/profil"
                        className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-gray-600 touch-manipulation"
                    >
                        <HiOutlineUser className="w-6 h-6" />
                        <span className="text-xs font-medium">Profil</span>
                    </Link>
                    <Link
                        href="/pelanggan/bantuan"
                        className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-sky-500 touch-manipulation"
                    >
                        <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
                            <HiOutlineInformationCircle className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium">Bantuan</span>
                    </Link>
                </div>
            </nav>
        </div>
    )
}
