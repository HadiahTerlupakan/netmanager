'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/components/customer/CustomerAuthProvider'
import {
    MdArrowBack,
    MdAccountCircle,
    MdRefresh,
    MdChatBubble,
} from 'react-icons/md'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'

interface Ticket {
    id: string
    ticketNumber: string
    subject: string
    status: string
    priority: string
    category: string
    createdAt: string
    replyCount: number
    lastReply?: {
        isFromAdmin: boolean
        createdAt: string
    } | null
}

export default function TicketHistoryPage() {
    const { isLoading: authLoading, isAuthenticated } = useCustomerAuth()
    const router = useRouter()
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [loading, setLoading] = useState(true)

    const loadTickets = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/customer/tickets')
            if (res.ok) {
                const data = await res.json()
                setTickets(data.tickets || [])
            }
        } catch (error) {
            console.error('Error loading tickets:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
            return
        }
        if (isAuthenticated) {
            loadTickets()
        }
    }, [authLoading, isAuthenticated, router, loadTickets])

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
            case 'WAITING_CUSTOMER': return 'Perlu Balasan'
            case 'RESOLVED': return 'Selesai'
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

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="bg-[#f6f7f8] dark:bg-[#101922] font-sans antialiased text-[#111418] dark:text-white min-h-screen">
            <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-white dark:bg-[#101922] shadow-2xl">

                {/* TopAppBar */}
                <div className="sticky top-0 z-50 flex items-center bg-white dark:bg-[#1C2630] p-4 pb-2 justify-between border-b border-gray-100 dark:border-gray-800">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-900 dark:text-white"
                    >
                        <MdArrowBack className="text-2xl" />
                    </button>
                    <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Riwayat Tiket</h2>
                    <div className="flex w-12 items-center justify-end">
                        <button
                            onClick={loadTickets}
                            className="flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <MdRefresh className={`text-[#111418] dark:text-white text-[24px] ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center py-20">
                            <MdChatBubble className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
                            <p className="text-gray-500 dark:text-gray-400 mb-4">Belum ada tiket dukungan</p>
                            <Link
                                href="/dukungan"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0d9488] text-white rounded-xl hover:bg-teal-600 transition-colors"
                            >
                                Buat Tiket Baru
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tickets.map((ticket) => (
                                <Link
                                    key={ticket.id}
                                    href={`/dukungan/${ticket.id}`}
                                    className="block p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1C2630] hover:border-[#0d9488]/50 transition-all"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`w-1.5 h-full min-h-[60px] rounded-full ${getPriorityColor(ticket.priority)}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-mono text-gray-500">
                                                    #{ticket.ticketNumber.split('-').pop()}
                                                </span>
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(ticket.status)}`}>
                                                    {getStatusLabel(ticket.status)}
                                                </span>
                                            </div>
                                            <p className="text-sm font-semibold text-[#111418] dark:text-white truncate">
                                                {ticket.subject}
                                            </p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-xs text-gray-500">
                                                    {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: id })}
                                                </span>
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    <MdChatBubble className="text-sm" />
                                                    {ticket.replyCount}
                                                    {ticket.lastReply && ticket.lastReply.isFromAdmin && ticket.status === 'WAITING_CUSTOMER' && (
                                                        <span className="ml-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Floating Add Button */}
                <Link
                    href="/dukungan"
                    className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-[#0d9488] text-white shadow-xl shadow-[#0d9488]/40 hover:bg-teal-600 active:scale-90 transition-transform"
                >
                    <span className="text-3xl font-light">+</span>
                </Link>
            </div>
        </div>
    )
}
