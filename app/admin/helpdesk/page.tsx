"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiTicket,
    HiClock,
    HiCheckCircle,
    HiXCircle,
    HiUsers,
    HiArrowTrendingUp,
    HiChartBar,
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

type Statistics = {
    total: number
    open: number
    inProgress: number
    waitingCustomer: number
    resolved: number
    closed: number
    avgResponseTimeHours: number
    avgResolutionTimeHours: number
    satisfactionRating: number | null
    totalWithRating: number
}

type RecentTicket = {
    id: string
    ticketNumber: string
    subject: string
    status: string
    priority: string
    createdAt: string
    pelanggan: {
        nama: string
    }
}

export default function HelpdeskDashboard() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState<Statistics | null>(null)
    const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([])

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login')
            return
        }

        if (session?.user && status === 'authenticated') {
            fetchData()
        }
    }, [session, status, router])

    const fetchData = async () => {
        try {
            const [statsRes, ticketsRes] = await Promise.all([
                fetch('/api/admin/helpdesk/stats'),
                fetch('/api/admin/helpdesk/tickets?limit=10'),
            ])

            if (statsRes.ok) {
                const result = await statsRes.json()
                setStats(result.data)
            }

            if (ticketsRes.ok) {
                const result = await ticketsRes.json()
                setRecentTickets(result.tickets || [])
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (status === 'loading' || loading) {
        return <PageLoader />
    }

    const formatHours = (hours: number) => {
        if (hours < 1) {
            return `${Math.round(hours * 60)} menit`
        }
        if (hours < 24) {
            return `${hours.toFixed(1)} jam`
        }
        return `${(hours / 24).toFixed(1)} hari`
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard Helpdesk</h1>
                <p className="text-gray-600 mt-1">Monitoring dan manajemen tiket bantuan</p>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Tickets */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Tiket</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <HiTicket className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    {/* Open Tickets */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Tiket Baru</p>
                                <p className="text-3xl font-bold text-orange-600 mt-1">{stats.open}</p>
                            </div>
                            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                                <HiClock className="w-6 h-6 text-orange-600" />
                            </div>
                        </div>
                    </div>

                    {/* In Progress */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Sedang Ditangani</p>
                                <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.inProgress}</p>
                            </div>
                            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <HiUsers className="w-6 h-6 text-yellow-600" />
                            </div>
                        </div>
                    </div>

                    {/* Resolved */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Selesai</p>
                                <p className="text-3xl font-bold text-green-600 mt-1">{stats.resolved}</p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <HiCheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Performance Metrics */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Avg Response Time */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                                <HiArrowTrendingUp className="w-5 h-5 text-sky-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900">Waktu Respon Rata-rata</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                            {formatHours(stats.avgResponseTimeHours)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">First response time</p>
                    </div>

                    {/* Avg Resolution Time */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <HiClock className="w-5 h-5 text-purple-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900">Waktu Penyelesaian Rata-rata</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                            {formatHours(stats.avgResolutionTimeHours)}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">Resolution time</p>
                    </div>

                    {/* Satisfaction Rating */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <HiChartBar className="w-5 h-5 text-amber-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900">Kepuasan Pelanggan</h3>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">
                            {stats.satisfactionRating ? `${stats.satisfactionRating.toFixed(1)}/5` : 'N/A'}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                            {stats.totalWithRating} rating diterima
                        </p>
                    </div>
                </div>
            )}

            {/* Recent Tickets */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Tiket Terbaru</h2>
                        <Link
                            href="/admin/helpdesk/tiket"
                            className="text-sm text-sky-600 hover:text-sky-700 font-medium"
                        >
                            Lihat Semua →
                        </Link>
                    </div>
                </div>
                <div className="divide-y divide-gray-200">
                    {recentTickets.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            Belum ada tiket
                        </div>
                    ) : (
                        recentTickets.map((ticket) => (
                            <Link
                                key={ticket.id}
                                href={`/admin/helpdesk/tiket/${ticket.id}`}
                                className="block p-4 hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs text-gray-500">{ticket.ticketNumber}</span>
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ticket.status === 'OPEN'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : ticket.status === 'IN_PROGRESS'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : ticket.status === 'RESOLVED'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}
                                            >
                                                {ticket.status}
                                            </span>
                                        </div>
                                        <h3 className="font-medium text-gray-900 truncate">{ticket.subject}</h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {ticket.pelanggan.nama}
                                        </p>
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {new Date(ticket.createdAt).toLocaleDateString('id-ID')}
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                    href="/admin/helpdesk/tiket?status=OPEN"
                    className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-lg p-6 hover:from-orange-600 hover:to-red-600 transition-all shadow-lg"
                >
                    <h3 className="text-lg font-semibold mb-2">Tiket Menunggu</h3>
                    <p className="text-white/90 text-sm mb-4">
                        Handle tiket yang belum ditangani
                    </p>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span>Lihat Tiket Baru</span>
                        <span>→</span>
                    </div>
                </Link>

                <Link
                    href="/admin/helpdesk/tiket?unassignedOnly=true"
                    className="bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-lg p-6 hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
                >
                    <h3 className="text-lg font-semibold mb-2">Belum Ditugaskan</h3>
                    <p className="text-white/90 text-sm mb-4">
                        Assign tiket ke staff yang available
                    </p>
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span>Kelola Assignment</span>
                        <span>→</span>
                    </div>
                </Link>
            </div>
        </div>
    )
}
