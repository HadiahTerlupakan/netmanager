'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiMagnifyingGlass,
    HiMapPin,
    HiClock,
    HiCheckCircle,
    HiChevronRight,
    HiClipboardDocumentList,
    HiHandRaised,
} from 'react-icons/hi2'

type WorkOrder = {
    id: string
    workOrderNumber: string
    title: string
    description: string
    type: string
    status: string
    priority: string
    pelanggan?: {
        nama: string
        noTelp: string | null
    } | null
    site?: {
        code: string
        name: string
    } | null
    assignedTo: {
        fullName: string
    } | null
    locationAddress: string | null
    contactName: string | null
    createdAt: string
}

type Stats = {
    available: number
    myTickets: number
}

type APIResponse = {
    success: boolean
    data: {
        workOrders: WorkOrder[]
        total: number
        stats: Stats
    }
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    ASSIGNED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    IN_PROGRESS: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    ON_HOLD: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    VERIFIED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
}

const PRIORITY_COLORS: Record<string, string> = {
    LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    NORMAL: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    HIGH: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    URGENT: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    CRITICAL: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
}

export default function WorkOrdersPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [stats, setStats] = useState<Stats>({ available: 0, myTickets: 0 })
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState('available') // 'available', 'my', 'all'
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        loadWorkOrders()
    }, [tab])

    const loadWorkOrders = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            params.append('tab', tab)
            if (searchQuery) {
                params.append('search', searchQuery)
            }

            const response = await fetch(`/api/employee/workorders?${params}`)
            if (response.ok) {
                const result: APIResponse = await response.json()
                setWorkOrders(result.data.workOrders)
                setStats(result.data.stats)
            }
        } catch (error) {
            console.error('Error loading work orders:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = () => {
        loadWorkOrders()
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Work Orders
                </h1>
                <p className="text-base sm:text-sm text-gray-600 dark:text-gray-400">
                    Ambil dan kerjakan tiket work order
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => setTab('available')}
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow p-5 text-left transition-all ${tab === 'available' ? 'ring-2 ring-indigo-500' : 'hover:shadow-md'
                        }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Tersedia</h3>
                        <HiClipboardDocumentList className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.available}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Tiket di area Anda</p>
                </button>

                <button
                    onClick={() => setTab('my')}
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow p-5 text-left transition-all ${tab === 'my' ? 'ring-2 ring-indigo-500' : 'hover:shadow-md'
                        }`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Tiket Saya</h3>
                        <HiHandRaised className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    {loading ? (
                        <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    ) : (
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.myTickets}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Yang Anda ambil</p>
                </button>
            </div>

            {/* Search */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
                <div className="flex gap-2">
                    <div className="flex-1 relative">
                        <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Cari work order..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                    >
                        Cari
                    </button>
                </div>
            </div>

            {/* Tab Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {tab === 'available' ? 'Tiket Tersedia' : tab === 'my' ? 'Tiket Saya' : 'Semua Tiket'}
                </h2>
                <button
                    onClick={() => setTab('all')}
                    className={`text-sm ${tab === 'all' ? 'text-indigo-600 font-medium' : 'text-gray-500 hover:text-indigo-600'
                        }`}
                >
                    Lihat Semua
                </button>
            </div>

            {/* Work Orders List */}
            <div className="space-y-4">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 animate-pulse">
                            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                            <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                    ))
                ) : workOrders.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                        <div className="inline-block p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                            <HiMapPin className="w-12 h-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            {tab === 'available'
                                ? 'Tidak ada tiket tersedia'
                                : tab === 'my'
                                    ? 'Belum ada tiket yang Anda ambil'
                                    : 'Tidak ada work order'}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            {tab === 'available'
                                ? 'Semua tiket di area Anda sudah diambil.'
                                : tab === 'my'
                                    ? 'Ambil tiket dari tab "Tersedia" untuk mulai bekerja.'
                                    : 'Belum ada work order yang tersedia.'}
                        </p>
                    </div>
                ) : (
                    workOrders.map((wo) => (
                        <Link
                            key={wo.id}
                            href={`/employee/workorders/${wo.id}`}
                            className="block bg-white dark:bg-gray-800 rounded-xl shadow hover:shadow-md transition-shadow p-5"
                        >
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                            {wo.workOrderNumber}
                                        </span>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${STATUS_COLORS[wo.status]}`}>
                                            {wo.status.replace('_', ' ')}
                                        </span>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[wo.priority]}`}>
                                            {wo.priority}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                                        {wo.title}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                        {wo.description}
                                    </p>
                                </div>
                                <HiChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                            </div>

                            <div className="flex flex-wrap gap-4 text-sm pt-3 border-t border-gray-200 dark:border-gray-700">
                                {wo.pelanggan && (
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">Customer: </span>
                                        <span className="text-gray-900 dark:text-white font-medium">{wo.pelanggan.nama}</span>
                                    </div>
                                )}
                                {wo.contactName && !wo.pelanggan && (
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">Contact: </span>
                                        <span className="text-gray-900 dark:text-white font-medium">{wo.contactName}</span>
                                    </div>
                                )}
                                {wo.site && (
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">Site: </span>
                                        <span className="text-gray-900 dark:text-white font-medium">{wo.site.code}</span>
                                    </div>
                                )}
                                {wo.assignedTo && (
                                    <div>
                                        <span className="text-gray-500 dark:text-gray-400">Diambil: </span>
                                        <span className="text-gray-900 dark:text-white font-medium">{wo.assignedTo.fullName}</span>
                                    </div>
                                )}
                                <div className="ml-auto">
                                    <span className="text-gray-500 dark:text-gray-400">{formatDate(wo.createdAt)}</span>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}
