'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    HiOutlineChatBubbleLeftRight,
    HiOutlineMagnifyingGlass,
    HiOutlineArrowPath,
    HiChevronLeft,
    HiChevronRight,
    HiOutlineTicket,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineStar,
} from 'react-icons/hi2'
import { formatDistanceToNow, format } from 'date-fns'
import { id } from 'date-fns/locale'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

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
    pelanggan: {
        id: string
        idPelanggan: string
        nama: string
        noTelp: string | null
        email: string | null
    }
    assignedTo: {
        id: string
        name: string
    } | null
    lastReply?: {
        isFromAdmin: boolean
        createdAt: string
        message?: string
    } | null
    replyCount: number
}

interface Stats {
    total: number
    open: number
    inProgress: number
    waitingCustomer: number
    resolved: number
    closed: number
    avgRating: number
    ratedCount: number
}

export default function SupportContext() {
    const router = useRouter()
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [_total, setTotal] = useState(0)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('')
    const [stats, setStats] = useState<Stats>({
        total: 0,
        open: 0,
        inProgress: 0,
        waitingCustomer: 0,
        resolved: 0,
        closed: 0,
        avgRating: 0,
        ratedCount: 0,
    })

    const loadTickets = useCallback(async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.set('page', page.toString())
            params.set('limit', '20')
            if (search) params.set('search', search)
            if (statusFilter) params.set('status', statusFilter)
            if (categoryFilter) params.set('category', categoryFilter)
            if (priorityFilter) params.set('priority', priorityFilter)

            const res = await fetch(`/api/admin/support-tickets?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                const responseData = data.data || data
                setTickets(responseData.tickets || [])
                setTotalPages(responseData.pagination?.totalPages || 1)
                setTotal(responseData.pagination?.total || 0)
                if (responseData.stats) {
                    setStats(responseData.stats)
                }
            }
        } catch (error) {
            console.error('Error loading tickets:', error)
        } finally {
            setLoading(false)
        }
    }, [page, search, statusFilter, categoryFilter, priorityFilter])

    useEffect(() => {
        loadTickets()
    }, [loadTickets])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OPEN':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            case 'IN_PROGRESS':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            case 'WAITING_CUSTOMER':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            case 'RESOLVED':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            case 'CLOSED':
                return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'OPEN': return 'Baru'
            case 'IN_PROGRESS': return 'Dalam Proses'
            case 'WAITING_CUSTOMER': return 'Menunggu Pelanggan'
            case 'RESOLVED': return 'Selesai Dikerjakan'
            case 'CLOSED': return 'Ditutup'
            default: return status
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'URGENT': return 'bg-red-500'
            case 'HIGH': return 'bg-orange-500'
            case 'MEDIUM': return 'bg-yellow-500'
            default: return 'bg-gray-400'
        }
    }

    const getCategoryLabel = (category: string) => {
        switch (category) {
            case 'TECHNICAL': return 'Teknis'
            case 'BILLING': return 'Tagihan'
            case 'ACCOUNT': return 'Akun'
            case 'OTHER': return 'Lainnya'
            default: return category
        }
    }

    // Extract rating from closed ticket's last message
    const extractRating = (ticket: Ticket): number | null => {
        if (ticket.status !== 'CLOSED' || !ticket.lastReply?.message) return null

        const message = ticket.lastReply.message
        if (message.includes('⭐⭐⭐⭐⭐')) return 5
        if (message.includes('⭐⭐⭐⭐')) return 4
        if (message.includes('⭐⭐⭐')) return 3
        if (message.includes('⭐⭐')) return 2
        if (message.includes('⭐')) return 1
        return null
    }

    const renderStars = (rating: number | null) => {
        if (rating === null) return <span className="text-gray-400 text-xs">-</span>
        return (
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <span
                        key={star}
                        className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
                    >
                        ★
                    </span>
                ))}
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <HiOutlineChatBubbleLeftRight className="w-7 h-7 text-teal-600" />
                        Tiket Dukungan Pelanggan
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Kelola tiket dukungan dari pelanggan
                    </p>
                </div>
                <button
                    onClick={loadTickets}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                    <HiOutlineArrowPath className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Total Tickets */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                            <HiOutlineTicket className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                            <p className="text-xs text-gray-500">Total Tiket</p>
                        </div>
                    </div>
                </div>

                {/* Open/New Tickets */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <HiOutlineClock className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.open + stats.inProgress}</p>
                            <p className="text-xs text-gray-500">Perlu Ditangani</p>
                        </div>
                    </div>
                </div>

                {/* Closed Tickets */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                            <HiOutlineCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.closed}</p>
                            <p className="text-xs text-gray-500">Selesai</p>
                        </div>
                    </div>
                </div>

                {/* Average Rating */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                            <HiOutlineStar className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-'}
                            </p>
                            <p className="text-xs text-gray-500">
                                Rating {stats.ratedCount > 0 ? `(${stats.ratedCount})` : ''}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-6">
                <div className="flex flex-wrap gap-4">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Cari tiket atau pelanggan..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        <option value="">Semua Status</option>
                        <option value="OPEN">Baru</option>
                        <option value="IN_PROGRESS">Dalam Proses</option>
                        <option value="WAITING_CUSTOMER">Menunggu Pelanggan</option>
                        <option value="RESOLVED">Selesai</option>
                        <option value="CLOSED">Ditutup</option>
                    </select>

                    {/* Category Filter */}
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        <option value="">Semua Kategori</option>
                        <option value="TECHNICAL">Teknis</option>
                        <option value="BILLING">Tagihan</option>
                        <option value="ACCOUNT">Akun</option>
                        <option value="OTHER">Lainnya</option>
                    </select>

                    {/* Priority Filter */}
                    <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                        <option value="">Semua Prioritas</option>
                        <option value="URGENT">Urgent</option>
                        <option value="HIGH">Tinggi</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Rendah</option>
                    </select>
                </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <ResponsiveTable
                    data={tickets}
                    keyField="id"
                    loading={loading}
                    onRowClick={(ticket) => router.push(`/admin/support/${ticket.id}`)}
                    emptyMessage={
                        <div className="text-center py-12">
                            <HiOutlineChatBubbleLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>Tidak ada tiket ditemukan</p>
                        </div>
                    }
                    columns={[
                        {
                            key: 'ticketNumber',
                            header: 'Tiket',
                            priority: 'primary',
                            render: (ticket: Ticket) => (
                                <div className="flex items-center gap-3">
                                    <div className={`w-1.5 h-10 rounded-full ${getPriorityColor(ticket.priority)}`} />
                                    <div>
                                        <div className="font-medium text-gray-900 dark:text-white">
                                            {ticket.subject}
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono">
                                            #{ticket.ticketNumber}
                                        </div>
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: 'pelanggan',
                            header: 'Pelanggan',
                            priority: 'primary',
                            render: (ticket: Ticket) => (
                                <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                        {ticket.pelanggan.nama}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {ticket.pelanggan.idPelanggan}
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: 'status',
                            header: 'Status',
                            priority: 'secondary',
                            render: (ticket: Ticket) => (
                                <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                                    {getStatusLabel(ticket.status)}
                                </span>
                            )
                        },
                        {
                            key: 'category',
                            header: 'Kategori',
                            priority: 'secondary',
                            render: (ticket: Ticket) => (
                                <span className="text-sm text-gray-600 dark:text-gray-400">{getCategoryLabel(ticket.category)}</span>
                            )
                        },
                        {
                            key: 'createdAt',
                            header: 'Dibuat',
                            priority: 'tertiary',
                            render: (ticket: Ticket) => (
                                <div>
                                    <div className="text-sm text-gray-900 dark:text-white">
                                        {format(new Date(ticket.createdAt), 'dd MMM yyyy', { locale: id })}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: id })}
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: 'replyCount',
                            header: 'Balasan',
                            priority: 'tertiary',
                            render: (ticket: Ticket) => (
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {ticket.replyCount}
                                    </span>
                                    {ticket.lastReply && !ticket.lastReply.isFromAdmin && ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Perlu balasan" />
                                    )}
                                </div>
                            )
                        },
                        {
                            key: 'rating',
                            header: 'Rating',
                            priority: 'tertiary',
                            render: (ticket: Ticket) => renderStars(extractRating(ticket))
                        }
                    ]}
                />

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-500">
                            Halaman {page} dari {totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <HiChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                disabled={page === totalPages}
                                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <HiChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
