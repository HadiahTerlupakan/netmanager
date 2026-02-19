'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { HiOutlineChatBubbleOvalLeft } from 'react-icons/hi2'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'
import { useRealtimeSupportTickets, type TicketPreview } from '@/lib/websocket/hooks/useRealtimeSupportTickets'
import { usePermission } from '@/hooks/use-permission'
import { getPriorityColor } from '@/lib/utils/priority-helpers'
import { useClickOutside } from '@/hooks/useClickOutside'

export function CustomerSupportBell() {
    const { hasPermission } = usePermission()
    const {
        tickets,
        unreadCount,
        loading,
        isConnected,
        refresh,
    } = useRealtimeSupportTickets({
        limit: 5,
        enabled: hasPermission('support:read') // Only fetch if user has permission
    })

    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    const closeDropdown = useCallback(() => setIsOpen(false), [])
    useClickOutside(dropdownRef, closeDropdown)

    // Refresh when dropdown is opened
    useEffect(() => {
        if (isOpen) {
            refresh()
        }
    }, [isOpen, refresh])

    // Listen for custom refresh event (can be triggered from other components)
    useEffect(() => {
        const handleRefresh = () => refresh()
        window.addEventListener('refreshSupportTickets', handleRefresh)
        return () => window.removeEventListener('refreshSupportTickets', handleRefresh)
    }, [refresh])

    // Hide component if no permission
    if (!hasPermission('support:read')) {
        return null
    }

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
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
        }
    }

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'OPEN':
                return 'Baru'
            case 'IN_PROGRESS':
                return 'Proses'
            case 'WAITING_CUSTOMER':
                return 'Menunggu'
            case 'RESOLVED':
                return 'Selesai'
            case 'CLOSED':
                return 'Ditutup'
            default:
                return status
        }
    }

    // Check if ticket needs attention (for visual indicator)
    const needsAttention = (ticket: TicketPreview) => {
        if (ticket.status === 'OPEN') return true
        if (ticket.lastReply && !ticket.lastReply.isFromAdmin) return true
        return false
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Chat Bubble Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-full transition-all duration-200 group ${unreadCount > 0
                    ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20'
                    : 'text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/10'
                    }`}
                aria-label="Customer Support Tickets"
                title="Tiket Dukungan Pelanggan"
            >
                <HiOutlineChatBubbleOvalLeft className="w-6 h-6" />
                {!loading && unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[20px] h-[20px] text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
                {/* WebSocket connection indicator */}
                {isConnected && (
                    <span className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900" title="Real-time connected" />
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-teal-50/50 dark:bg-teal-900/20">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <HiOutlineChatBubbleOvalLeft className="w-4 h-4 text-teal-600" />
                            Tiket Dukungan
                            {isConnected && (
                                <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                    Live
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <span className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                                    {unreadCount} perlu respon
                                </span>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    refresh()
                                }}
                                className="p-1 text-gray-400 hover:text-teal-600 rounded transition-colors"
                                title="Refresh"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Ticket List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {tickets.length === 0 ? (
                            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                <HiOutlineChatBubbleOvalLeft className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Tidak ada tiket aktif</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                {tickets.map((ticket) => (
                                    <Link
                                        key={ticket.id}
                                        href={`/admin/support/${ticket.id}`}
                                        onClick={() => setIsOpen(false)}
                                        className={`block p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 ${getPriorityColor(ticket.priority, 'border-l-gray-300')} ${needsAttention(ticket) ? 'bg-red-50/30 dark:bg-red-900/5' : ''
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-mono text-gray-500">
                                                        #{ticket.ticketNumber.split('-').pop()}
                                                    </span>
                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getStatusColor(ticket.status)}`}>
                                                        {getStatusLabel(ticket.status)}
                                                    </span>
                                                    {needsAttention(ticket) && (
                                                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                    )}
                                                </div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {ticket.subject}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                    {ticket.pelanggan.nama}
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-gray-400 shrink-0">
                                                {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true, locale: id })}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {tickets.length > 0 && (
                        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                            <Link
                                href="/admin/support"
                                onClick={() => setIsOpen(false)}
                                className="block text-center text-sm text-teal-600 dark:text-teal-400 hover:underline font-medium"
                            >
                                Lihat Semua Tiket →
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
