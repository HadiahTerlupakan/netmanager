'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCustomerAuth } from '@/components/customer/CustomerAuthProvider'
import {
    MdArrowBackIos,
    MdHelpOutline,
    MdCalendarToday,
    MdRouter,
    MdVerifiedUser,
    MdPendingActions,
    MdReceiptLong,
    MdCreditCard,
    MdAutorenew,
    MdCheckCircle,
    MdCancel
} from 'react-icons/md'

interface Invoice {
    id: string
    invoiceNumber: string
    amount: number
    remainingAmount: number
    status: string // 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID'
    dueDate: string
    createdAt: string
    items: Array<{ description: string }>
}

export default function CustomerInvoicesPage() {
    const { isLoading: authLoading, isAuthenticated } = useCustomerAuth()
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<'ALL' | 'PAID' | 'UNPAID' | 'FAILED'>('ALL')
    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login')
        }
    }, [authLoading, isAuthenticated, router])

    useEffect(() => {
        if (isAuthenticated) {
            fetchInvoices()
        }
    }, [isAuthenticated])

    const fetchInvoices = async () => {
        try {
            const res = await fetch('/api/customer/invoices?limit=20') // Fetch more for history
            const json = await res.json()
            if (json.success) {
                setInvoices(json.invoices)
            }
        } catch (error) {
            console.error('Failed to fetch invoices:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Filter Logic
    const filteredInvoices = invoices.filter(inv => {
        if (filter === 'ALL') return true
        if (filter === 'PAID') return inv.status === 'PAID'
        if (filter === 'UNPAID') return ['SENT', 'OVERDUE'].includes(inv.status)
        if (filter === 'FAILED') return inv.status === 'VOID' // Assuming VOID is failed/cancelled
        return true
    })

    // Calculate Total Pending
    const pendingInvoices = invoices.filter(inv => ['SENT', 'OVERDUE'].includes(inv.status))
    const totalPending = pendingInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0)
    const nextDueDate = pendingInvoices.length > 0
        ? pendingInvoices.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0].dueDate
        : null

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'PAID':
                return {
                    label: 'Lunas',
                    colorClass: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 ring-green-600/20 dark:ring-green-400/20',
                    icon: MdReceiptLong
                }
            case 'SENT':
            case 'OVERDUE':
                return {
                    label: 'Belum Bayar',
                    colorClass: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 ring-orange-600/10 dark:ring-orange-400/20',
                    icon: MdPendingActions
                }
            default:
                return {
                    label: status,
                    colorClass: 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 ring-gray-600/20',
                    icon: MdReceiptLong
                }
        }
    }

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#f6f7f8] dark:bg-[#101922]">
                <div className="w-10 h-10 border-4 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full bg-[#f6f7f8] dark:bg-[#101922] font-sans text-[#111418] dark:text-white transition-colors duration-200">
            <div className="relative flex h-auto min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-[#f6f7f8] dark:bg-[#101922]">

                {/* Top App Bar */}
                <div className="flex items-center bg-white dark:bg-[#1a2632] p-4 pb-2 justify-between sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex w-10 h-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-gray-900 dark:text-white"
                    >
                        <MdArrowBackIos className="text-2xl" />
                    </button>
                    <h2 className="text-[#111418] dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Tagihan & Pembayaran</h2>
                    <div className="flex w-12 items-center justify-end">
                        <button className="flex size-12 cursor-pointer items-center justify-center rounded-lg bg-transparent text-[#111418] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <MdHelpOutline className="text-2xl" />
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto pb-24"> {/* Added pb-24 for bottom spacing */}

                    {/* Hero Card: Current Bill */}
                    <div className="p-4">
                        <div className="relative overflow-hidden rounded-xl bg-[#0d9488] shadow-lg dark:shadow-teal-900/20">
                            {/* Background Image with Overlay */}
                            <div
                                className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay"
                                style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC-HU9cqe6mcWGdTC97GiGE9Cpcz8BtknnjXpnAibr__w5Mp18897Z_ETiwCLP8684O2A6OaPPZG2gbjE9V33mJP_kcjPCud4uMkUHdMLUcO0x3njsMz_j2y4XLD044QbwKs0F7O2ZI-06Kw3uPuoYqeR5Qkk6AUXB9CMWFWY9iFrqApW30mSi65fUu9lXbRZD8FNxiSd05IMYrDtabjomcqLhA659gZookpcmJCXKGjJ4FtmYOthORCnxg8wXQzQZKZB3jyc1iark")' }}
                            ></div>
                            <div className="relative z-10 flex flex-col p-6 h-full justify-between min-h-[220px]">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-white/90 text-sm font-medium">Total Tagihan Bulan Ini</p>
                                        <h1 className="text-white text-3xl font-bold tracking-tight">
                                            {formatCurrency(totalPending)}
                                        </h1>
                                        {nextDueDate ? (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <MdCalendarToday className="text-white/80 text-sm" />
                                                <p className="text-white/80 text-xs font-medium">Jatuh tempo {formatDate(nextDueDate)}</p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <MdCheckCircle className="text-white/80 text-sm" />
                                                <p className="text-white/80 text-xs font-medium">Tidak ada tagihan tertunggak</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-white/20 backdrop-blur-sm p-2 rounded-lg">
                                        <MdRouter className="text-white" />
                                    </div>
                                </div>
                                <div className="mt-6 flex flex-col gap-3">
                                    <div className="flex items-center gap-2 text-white/80 text-xs">
                                        <MdVerifiedUser className="text-[16px]" />
                                        <span>Pembayaran aman & terenkripsi</span>
                                    </div>
                                    {totalPending > 0 && (
                                        <button className="flex w-full cursor-pointer items-center justify-center rounded-lg h-12 bg-white text-[#0d9488] hover:bg-gray-50 active:scale-[0.98] transition-all text-base font-bold leading-normal tracking-[0.015em] shadow-sm">
                                            <span>Bayar Sekarang</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Headline: Transaction History */}
                    <div className="px-4 pt-4 pb-2 flex justify-between items-end">
                        <h3 className="text-[#111418] dark:text-white tracking-tight text-xl font-bold leading-tight">Riwayat Transaksi</h3>
                        <button className="text-[#0d9488] text-sm font-semibold hover:underline">Unduh Semua</button>
                    </div>

                    {/* Filter Chips */}
                    <div className="w-full overflow-x-auto hide-scrollbar pb-2">
                        <div className="flex gap-3 px-4 min-w-max">
                            <button
                                onClick={() => setFilter('ALL')}
                                className={`flex h-9 items-center justify-center px-4 rounded-full transition-colors ${filter === 'ALL'
                                    ? 'bg-[#111418] dark:bg-white text-white dark:text-[#111418]'
                                    : 'bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-gray-700 text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <p className="text-sm font-medium">Semua</p>
                            </button>
                            <button
                                onClick={() => setFilter('PAID')}
                                className={`flex h-9 items-center justify-center px-4 rounded-full transition-colors ${filter === 'PAID'
                                    ? 'bg-[#111418] dark:bg-white text-white dark:text-[#111418]'
                                    : 'bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-gray-700 text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <p className="text-sm font-medium">Lunas</p>
                            </button>
                            <button
                                onClick={() => setFilter('UNPAID')}
                                className={`flex h-9 items-center justify-center px-4 rounded-full transition-colors ${filter === 'UNPAID'
                                    ? 'bg-[#111418] dark:bg-white text-white dark:text-[#111418]'
                                    : 'bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-gray-700 text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <p className="text-sm font-medium">Belum Bayar</p>
                            </button>
                            <button
                                onClick={() => setFilter('FAILED')}
                                className={`flex h-9 items-center justify-center px-4 rounded-full transition-colors ${filter === 'FAILED'
                                    ? 'bg-[#111418] dark:bg-white text-white dark:text-[#111418]'
                                    : 'bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-gray-700 text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <p className="text-sm font-medium">Gagal</p>
                            </button>
                        </div>
                    </div>

                    {/* List of Transactions */}
                    <div className="flex flex-col mt-2">
                        {filteredInvoices.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <p>Tidak ada riwayat transaksi</p>
                            </div>
                        ) : (
                            filteredInvoices.map((invoice) => {
                                const statusInfo = getStatusInfo(invoice.status)
                                const Icon = statusInfo.icon

                                // Parse date for month display
                                const dateObj = new Date(invoice.createdAt)
                                const monthYear = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

                                return (
                                    <div key={invoice.id} className="group cursor-pointer active:bg-gray-50 dark:active:bg-gray-800 transition-colors">
                                        <div className="flex items-center gap-4 bg-white dark:bg-[#1a2632] px-4 py-4 justify-between border-b border-gray-100 dark:border-gray-800">
                                            <div className="flex items-center gap-4">
                                                <div className={`flex items-center justify-center rounded-full shrink-0 size-12 ${invoice.status === 'PAID' ? 'bg-[#f6f7f8] dark:bg-gray-800 text-gray-600 dark:text-gray-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                                                    }`}>
                                                    <Icon className="text-2xl" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <p className="text-[#111418] dark:text-white text-base font-semibold leading-tight capitalize">
                                                        {monthYear}
                                                    </p>
                                                    <p className="text-gray-500 dark:text-gray-400 text-xs font-medium line-clamp-1">
                                                        {invoice.invoiceNumber} • {invoice.items[0]?.description || 'Layanan Internet'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <p className="text-[#111418] dark:text-white font-bold text-base">
                                                    {formatCurrency(invoice.amount)}
                                                </p>
                                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusInfo.colorClass}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {/* Quick Actions Section */}
                    <div className="px-4 mt-6 mb-4">
                        <div className="grid grid-cols-2 gap-3">
                            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-800 transition-colors hover:border-[#0d9488]/50">
                                <MdCreditCard className="text-[#0d9488] text-3xl" />
                                <span className="text-sm font-medium text-[#111418] dark:text-white">Metode Bayar</span>
                            </button>
                            <button className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white dark:bg-[#1a2632] border border-gray-200 dark:border-gray-700 active:bg-gray-50 dark:active:bg-gray-800 transition-colors hover:border-[#0d9488]/50">
                                <MdAutorenew className="text-[#0d9488] text-3xl" />
                                <span className="text-sm font-medium text-[#111418] dark:text-white">Auto Debet</span>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
