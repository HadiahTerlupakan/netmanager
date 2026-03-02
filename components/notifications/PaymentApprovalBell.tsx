'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { useClickOutside } from '@/hooks/useClickOutside'
import { HiOutlineReceiptRefund, HiOutlineCheckCircle } from 'react-icons/hi2'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'

import { useRealtimePaymentApprovals } from '@/lib/websocket/hooks/useRealtimePaymentApprovals'
import { useFCM } from '@/hooks/useFCM'

const LAST_READ_KEY = 'payment-approval-last-read'

export function PaymentApprovalBell() {
    useFCM() // Setup FCM Token & Foreground UI Toast listener
    const { payments, loading, isConnected, refresh } = useRealtimePaymentApprovals()
    const [isOpen, setIsOpen] = useState(false)
    const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(0)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const prevMaxDateRef = useRef<number>(0)

    // Load last-read timestamp from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(LAST_READ_KEY)
        if (stored) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLastReadTimestamp(Number(stored))
        }
    }, [])

    // Calculate unread count — only payments newer than lastReadTimestamp
    const unreadCount = useMemo(() => {
        if (lastReadTimestamp === 0) return payments.length
        return payments.filter(p => new Date(p.createdAt).getTime() > lastReadTimestamp).length
    }, [payments, lastReadTimestamp])

    // Mark all as read
    const handleMarkAllRead = useCallback(() => {
        if (payments.length === 0) return
        const maxDate = Math.max(...payments.map(p => new Date(p.createdAt).getTime()))
        setLastReadTimestamp(maxDate)
        localStorage.setItem(LAST_READ_KEY, String(maxDate))
    }, [payments])

    // Close dropdown when clicking outside
    const closeDropdown = useCallback(() => setIsOpen(false), [])
    useClickOutside(dropdownRef, closeDropdown)

    // Refresh when dropdown opens
    useEffect(() => {
        if (isOpen) {
            refresh()
        }
    }, [isOpen, refresh])

    useEffect(() => {
        if (payments.length > 0) {
            const currentMaxDate = Math.max(...payments.map(p => new Date(p.createdAt).getTime()))

            // Only play sound if it's not the initial load and there's a new payment
            if (prevMaxDateRef.current > 0 && currentMaxDate > prevMaxDateRef.current) {
                try {
                    const audio = new Audio('/sounds/notification.mp3')
                    audio.play().catch(e => console.error('Audio play failed:', e))
                } catch (e) {
                    console.error('Audio initialization failed:', e)
                }
            }

            if (currentMaxDate > prevMaxDateRef.current) {
                prevMaxDateRef.current = currentMaxDate
            }
        }
    }, [payments])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                className="relative group"
                aria-label="Pending Payments"
                title="Persetujuan Pembayaran"
            >
                <HiOutlineReceiptRefund className="w-6 h-6" />
                {!loading && unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white bg-orange-500 rounded-full border-2 border-white dark:border-gray-900 group-hover:scale-110 transition-transform px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
                {/* WebSocket connection indicator */}
                {isConnected && (
                    <span className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900" title="Real-time connected" />
                )}
            </Button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Persetujuan Pembayaran</h3>
                            {isConnected && (
                                <span className="text-[10px] text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                                    Live
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllRead}
                                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors font-medium"
                            >
                                <HiOutlineCheckCircle className="w-4 h-4" />
                                Tandai Sudah Dibaca
                            </button>
                        )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                <p className="text-sm">Memuat data...</p>
                            </div>
                        ) : payments.length === 0 ? (
                            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                <HiOutlineReceiptRefund className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Tidak ada pembayaran menunggu</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                {payments.map((payment) => {
                                    const isUnread = lastReadTimestamp === 0 || new Date(payment.createdAt).getTime() > lastReadTimestamp
                                    return (
                                        <div
                                            key={payment.id}
                                            className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-4 ${isUnread
                                                ? 'border-l-orange-500 bg-orange-50/30 dark:bg-orange-900/10'
                                                : 'border-l-gray-200 dark:border-l-gray-700 bg-white dark:bg-gray-900'
                                                }`}
                                        >
                                            <div className="flex gap-3">
                                                <div className="shrink-0 mt-0.5">
                                                    <HiOutlineReceiptRefund className={`w-5 h-5 ${isUnread ? 'text-orange-500' : 'text-gray-400'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col gap-0.5">
                                                        <p className={`text-sm font-semibold truncate ${isUnread ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                                                            {payment.customerName}
                                                        </p>
                                                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                            {payment.invoice?.invoiceNumber || 'Tagihan'}
                                                        </p>
                                                    </div>
                                                    <p className={`text-xs mt-1 font-semibold ${isUnread ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}`}>
                                                        {formatCurrency(payment.amount)}
                                                    </p>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <span className="text-[10px] text-gray-400">
                                                            {formatDistanceToNow(new Date(payment.createdAt), { addSuffix: true, locale: id })}
                                                        </span>
                                                        <Link
                                                            href="/admin/finance/manual-payments"
                                                            onClick={() => setIsOpen(false)}
                                                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                                                        >
                                                            Review Struk →
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
