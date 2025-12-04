"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
    HiMagnifyingGlass,
    HiAdjustmentsHorizontal,
    HiPlus,
    HiXMark,
} from 'react-icons/hi2'
import { TicketStatusBadge } from '@/components/helpdesk/TicketStatusBadge'
import { TicketPriorityBadge } from '@/components/helpdesk/TicketPriorityBadge'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import PageLoader from '@/components/ui/PageLoader'

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
    pelanggan: {
        id: string
        idPelanggan: string
        nama: string
    }
    createdAt: string
    lastActivityAt: string
}

export default function HelpdeskTicketsPage() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [loading, setLoading] = useState(true)
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [showFilters, setShowFilters] = useState(false)

    // Filter states
    const [search, setSearch] = useState('')
    const [filterStatus, setFilterStatus] = useState(searchParams?.get('status') || '')
    const [filterPriority, setFilterPriority] = useState('')
    const [unassignedOnly, setUnassignedOnly] = useState(searchParams?.get('unassignedOnly') === 'true')

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }

        if (session?.user && status === 'authenticated') {
            fetchTickets()
        }
    }, [session, status, router, page, search, filterStatus, filterPriority, unassignedOnly])

    const fetchTickets = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            })

            if (search) params.append('search', search)
            if (filterStatus) params.append('status', filterStatus)
            if (filterPriority) params.append('priority', filterPriority)
            if (unassignedOnly) params.append('unassignedOnly', 'true')

            const response = await fetch(`/api/admin/helpdesk/tickets?${params}`)

            if (response.ok) {
                const result = await response.json()
                setTickets(result.tickets || [])
                setTotal(result.total || 0)
                setTotalPages(result.totalPages || 1)
            }
        } catch (error) {
            console.error('Error fetching tickets:', error)
        } finally {
            setLoading(false)
        }
    }

    const clearFilters = () => {
        setFilterStatus('')
        setFilterPriority('')
        setUnassignedOnly(false)
        setSearch('')
    }

    const hasActiveFilters = filterStatus || filterPriority || unassignedOnly || search

    if (status === 'loading' || loading) {
        return <PageLoader />
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Semua Tiket</h1>
                    <p className="text-gray-600 mt-1">Total {total} tiket</p>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <HiAdjustmentsHorizontal className="w-5 h-5" />
                    <span>Filter</span>
                    {hasActiveFilters && (
                        <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
                    )}
                </button>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-white rounded-lg shadow p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Filter Tiket</h3>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-sky-600 hover:text-sky-700 font-medium"
                            >
                                Reset Filter
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Status Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                            >
                                <option value="">Semua Status</option>
                                <option value="OPEN">Baru</option>
                                <option value="IN_PROGRESS">Sedang Ditangani</option>
                                <option value="WAITING_CUSTOMER">Menunggu Respon</option>
                                <option value="RESOLVED">Selesai</option>
                                <option value="CLOSED">Ditutup</option>
                            </select>
                        </div>

                        {/* Priority Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Prioritas
                            </label>
                            <select
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                            >
                                <option value="">Semua Prioritas</option>
                                <option value="LOW">Rendah</option>
                                <option value="NORMAL">Normal</option>
                                <option value="HIGH">Tinggi</option>
                                <option value="URGENT">Mendesak</option>
                            </select>
                        </div>

                        {/* Unassigned Only */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Assignment
                            </label>
                            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                                <input
                                    type="checkbox"
                                    checked={unassignedOnly}
                                    onChange={(e) => setUnassignedOnly(e.target.checked)}
                                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="text-sm text-gray-700">Hanya Belum Ditugaskan</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div className="relative">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Cari nomor tiket, subject, atau nama pelanggan..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
            </div>

            {/* Tickets Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tiket
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Pelanggan
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Prioritas
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Terakhir Update
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {tickets.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        {hasActiveFilters
                                            ? 'Tidak ada tiket dengan filter yang dipilih'
                                            : 'Belum ada tiket'}
                                    </td>
                                </tr>
                            ) : (
                                tickets.map((ticket) => (
                                    <tr
                                        key={ticket.id}
                                        className="hover:bg-gray-50 cursor-pointer"
                                        onClick={() => router.push(`/admin/helpdesk/tiket/${ticket.id}`)}
                                    >
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-xs text-gray-500 mb-1">{ticket.ticketNumber}</div>
                                                <div className="font-medium text-gray-900 line-clamp-1">{ticket.subject}</div>
                                                {ticket.category && (
                                                    <span
                                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border mt-1"
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
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-gray-900">{ticket.pelanggan.nama}</div>
                                                <div className="text-xs text-gray-500">{ticket.pelanggan.idPelanggan}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <TicketStatusBadge status={ticket.status} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <TicketPriorityBadge priority={ticket.priority} />
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {formatDistanceToNow(new Date(ticket.lastActivityAt), {
                                                addSuffix: true,
                                                locale: localeId,
                                            })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        Halaman {page} dari {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(page - 1)}
                            disabled={page === 1}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Sebelumnya
                        </button>
                        <button
                            onClick={() => setPage(page + 1)}
                            disabled={page === totalPages}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Selanjutnya
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
