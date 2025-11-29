"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiArrowLeft,
    HiOutlineHome,
    HiOutlineDocumentText,
    HiOutlineUser,
    HiOutlineInformationCircle,
    HiBell,
    HiTicket,
    HiPlus,
    HiMagnifyingGlass,
} from 'react-icons/hi2'
import { TicketStatusBadge } from '@/components/helpdesk/TicketStatusBadge'
import { TicketPriorityBadge } from '@/components/helpdesk/TicketPriorityBadge'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

type Ticket = {
    id: string
    ticketNumber: string
    subject: string
    status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
    category?: {
        name: string
        color?: string
    } | null
    createdAt: string
    lastActivityAt: string
}

export default function TiketPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([])
    const [filterStatus, setFilterStatus] = useState<string>('ALL')
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        const checkAuth = () => {
            const token = localStorage.getItem('pelanggan_token')
            const pelangganData = localStorage.getItem('pelanggan_data')

            if (!token || !pelangganData) {
                router.push('/pelanggan/login')
                return
            }

            fetchTickets()
        }

        checkAuth()
    }, [router])

    const fetchTickets = async () => {
        try {
            const pelangganData = JSON.parse(localStorage.getItem('pelanggan_data') || '{}')

            const response = await fetch('/api/pelanggan/tickets', {
                headers: {
                    'pelanggan-data': JSON.stringify(pelangganData),
                },
            })

            if (response.ok) {
                const result = await response.json()
                setTickets(result.data)
                setFilteredTickets(result.data)
            }
        } catch (error) {
            console.error('Error fetching tickets:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let filtered = tickets

        // Filter by status
        if (filterStatus !== 'ALL') {
            filtered = filtered.filter((ticket) => ticket.status === filterStatus)
        }

        // Filter by search query
        if (searchQuery) {
            filtered = filtered.filter(
                (ticket) =>
                    ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }

        setFilteredTickets(filtered)
    }, [filterStatus, searchQuery, tickets])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-gray-500">Memuat data...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
            {/* Header */}
            <header className="bg-gradient-to-r from-sky-400 to-cyan-500 text-white shadow-lg">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link
                                href="/pelanggan/bantuan"
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                            >
                                <HiArrowLeft className="w-5 h-5" />
                            </Link>
                            <h1 className="text-xl font-bold">Tiket Bantuan</h1>
                        </div>
                        <Link
                            href="/pelanggan/bantuan/tiket/buat"
                            className="bg-white text-sky-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-sky-50 transition-colors active:scale-[0.98] touch-manipulation flex items-center gap-2"
                        >
                            <HiPlus className="w-4 h-4" />
                            <span>Buat Tiket</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-4 py-4">
                {/* Search Bar */}
                <div className="mb-4">
                    <div className="relative">
                        <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Cari nomor tiket atau judul..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                    {[
                        { value: 'ALL', label: 'Semua' },
                        { value: 'OPEN', label: 'Baru' },
                        { value: 'IN_PROGRESS', label: 'Ditangani' },
                        { value: 'RESOLVED', label: 'Selesai' },
                        { value: 'CLOSED', label: 'Ditutup' },
                    ].map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setFilterStatus(filter.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === filter.value
                                    ? 'bg-sky-500 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                {/* Tickets List */}
                <div className="space-y-3">
                    {filteredTickets.map((ticket) => (
                        <Link
                            key={ticket.id}
                            href={`/pelanggan/bantuan/tiket/${ticket.id}`}
                            className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow active:scale-[0.98] touch-manipulation"
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 mb-1">{ticket.ticketNumber}</p>
                                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                                        {ticket.subject}
                                    </h3>
                                </div>
                                <TicketStatusBadge status={ticket.status} />
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
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

                            <p className="text-xs text-gray-500 mt-2">
                                Terakhir diupdate{' '}
                                {formatDistanceToNow(new Date(ticket.lastActivityAt), {
                                    addSuffix: true,
                                    locale: localeId,
                                })}
                            </p>
                        </Link>
                    ))}

                    {filteredTickets.length === 0 && (
                        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                            <HiTicket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Tidak ada tiket
                            </h3>
                            <p className="text-gray-500 mb-4">
                                {searchQuery || filterStatus !== 'ALL'
                                    ? 'Tidak ditemukan tiket dengan filter yang dipilih'
                                    : 'Anda belum memiliki tiket bantuan'}
                            </p>
                            <Link
                                href="/pelanggan/bantuan/tiket/buat"
                                className="inline-flex items-center gap-2 bg-sky-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-sky-600 transition-colors"
                            >
                                <HiPlus className="w-5 h-5" />
                                <span>Buat Tiket Baru</span>
                            </Link>
                        </div>
                    )}
                </div>
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
