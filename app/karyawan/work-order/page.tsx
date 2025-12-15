'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useKaryawanAuth } from '@/components/karyawan/KaryawanAuthProvider'
import {
    MdArrowBack,
    MdFilterList,
    MdLocationOn,
    MdAccessTime,
    MdPerson,
    MdArrowForward
} from 'react-icons/md'
import Link from 'next/link'

interface WorkOrder {
    id: string
    workOrderNumber: string
    title: string
    type: string
    status: string
    priority: string
    locationAddress: string | null
    scheduledDate: string | null
    pelanggan?: {
        nama: string
    } | null
    assignedTo?: {
        name: string
    } | null
}

type TabType = 'tersedia' | 'saya'

export default function WorkOrderListPage() {
    const { isLoading: authLoading, isAuthenticated, user } = useKaryawanAuth()
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<TabType>('tersedia')
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/karyawan/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (isAuthenticated) {
            fetchWorkOrders()
        }
    }, [isAuthenticated, activeTab])

    const fetchWorkOrders = async () => {
        setIsLoading(true)
        try {
            const endpoint = activeTab === 'saya'
                ? '/api/karyawan/work-order/saya'
                : '/api/karyawan/work-order'
            const res = await fetch(endpoint)
            if (res.ok) {
                const data = await res.json()
                setWorkOrders(data.workOrders || [])
            }
        } catch (error) {
            console.error('Failed to fetch work orders:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'URGENT':
            case 'CRITICAL':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            case 'HIGH':
                return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
            case 'NORMAL':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            case 'ASSIGNED':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            case 'IN_PROGRESS':
                return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
            case 'COMPLETED':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
        }
    }

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white font-sans antialiased">
            <div className="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-[#f6f7f8] dark:bg-[#101922] shadow-xl">

                {/* Header */}
                <div className="sticky top-0 z-20 bg-[#f6f7f8] dark:bg-[#101922] border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center p-4 pb-2 justify-between">
                        <Link href="/karyawan/dashboard" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <MdArrowBack className="text-2xl" />
                        </Link>
                        <h2 className="text-lg font-bold leading-tight">Work Order</h2>
                        <button className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                            <MdFilterList className="text-2xl" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex px-4 pb-3 gap-2">
                        <button
                            onClick={() => setActiveTab('tersedia')}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'tersedia'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-[#1c2936] text-gray-600 dark:text-gray-400'
                                }`}
                        >
                            Tersedia
                        </button>
                        <button
                            onClick={() => setActiveTab('saya')}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'saya'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-[#1c2936] text-gray-600 dark:text-gray-400'
                                }`}
                        >
                            Milik Saya
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 pb-24 px-4 pt-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : workOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                <MdFilterList className="text-3xl text-gray-400" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">
                                {activeTab === 'tersedia' ? 'Tidak ada tiket tersedia' : 'Belum ada tiket yang diambil'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {workOrders.map((wo) => {
                                const isCompleted = wo.status === 'COMPLETED'
                                const CardContent = (
                                    <div className={`rounded-xl p-4 shadow-sm border transition-colors ${isCompleted
                                            ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-75'
                                            : 'bg-white dark:bg-[#1c2936] border-gray-100 dark:border-gray-800 hover:border-blue-500/50'
                                        }`}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-1">
                                                    {wo.workOrderNumber}
                                                </p>
                                                <h3 className={`font-semibold line-clamp-2 ${isCompleted
                                                        ? 'text-gray-600 dark:text-gray-400'
                                                        : 'text-[#111418] dark:text-white'
                                                    }`}>
                                                    {wo.title}
                                                </h3>
                                            </div>
                                            {!isCompleted && <MdArrowForward className="text-gray-400 ml-2 flex-shrink-0" />}
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-3">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(wo.status)}`}>
                                                {wo.status.replace('_', ' ')}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(wo.priority)}`}>
                                                {wo.priority}
                                            </span>
                                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                                {wo.type}
                                            </span>
                                        </div>

                                        <div className="space-y-1.5 text-sm text-gray-500 dark:text-gray-400">
                                            {wo.pelanggan && (
                                                <div className="flex items-center gap-2">
                                                    <MdPerson className="text-base flex-shrink-0" />
                                                    <span className="truncate">{wo.pelanggan.nama}</span>
                                                </div>
                                            )}
                                            {wo.locationAddress && (
                                                <div className="flex items-center gap-2">
                                                    <MdLocationOn className="text-base flex-shrink-0" />
                                                    <span className="truncate">{wo.locationAddress}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <MdAccessTime className="text-base flex-shrink-0" />
                                                <span>{formatDate(wo.scheduledDate)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )

                                return isCompleted ? (
                                    <div key={wo.id}>{CardContent}</div>
                                ) : (
                                    <Link key={wo.id} href={`/karyawan/work-order/${wo.id}`}>
                                        {CardContent}
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
