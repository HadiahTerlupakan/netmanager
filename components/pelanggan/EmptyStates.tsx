/**
 * Empty state components for customer portal
 */

import React from 'react'
import Link from 'next/link'
import {
    HiOutlineDocumentText,
    HiOutlineInboxArrowDown,
    HiOutlineExclamationCircle,
    HiOutlineCheckCircle,
    HiOutlineQuestionMarkCircle,
} from 'react-icons/hi2'

interface EmptyStateProps {
    icon?: React.ReactNode
    title: string
    description?: string
    action?: {
        label: string
        href?: string
        onClick?: () => void
    }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            {icon && (
                <div className="w-16 h-16 mx-auto mb-4 text-gray-400">
                    {icon}
                </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            {description && (
                <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">{description}</p>
            )}
            {action && (
                <>
                    {action.href ? (
                        <Link
                            href={action.href}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors text-sm font-medium"
                        >
                            {action.label}
                        </Link>
                    ) : (
                        <button
                            onClick={action.onClick}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors text-sm font-medium"
                        >
                            {action.label}
                        </button>
                    )}
                </>
            )}
        </div>
    )
}

// Empty state for no bills
export function EmptyBills() {
    return (
        <EmptyState
            icon={<HiOutlineDocumentText className="w-full h-full" />}
            title="Belum ada tagihan"
            description="Tagihan akan muncul setelah di-generate oleh admin sistem"
        />
    )
}

// Empty state for all bills paid
export function AllBillsPaid() {
    return (
        <EmptyState
            icon={<HiOutlineCheckCircle className="w-full h-full text-green-500" />}
            title="Semua tagihan sudah lunas"
            description="Terima kasih atas pembayaran tepat waktu Anda!"
        />
    )
}

// Empty state for no payment history
export function EmptyPaymentHistory() {
    return (
        <EmptyState
            icon={<HiOutlineInboxArrowDown className="w-full h-full" />}
            title="Belum ada riwayat pembayaran"
            description="Riwayat pembayaran Anda akan muncul di sini setelah melakukan pembayaran pertama"
        />
    )
}

// Empty state for no tickets
export function EmptyTickets() {
    return (
        <EmptyState
            icon={<HiOutlineQuestionMarkCircle className="w-full h-full" />}
            title="Belum ada tiket bantuan"
            description="Buat tiket bantuan jika Anda memerlukan dukungan dari tim kami"
            action={{
                label: 'Buat Tiket Baru',
                href: '/pelanggan/bantuan/tiket/buat',
            }}
        />
    )
}

// Empty state for error
export function ErrorState({
    message = 'Terjadi kesalahan saat memuat data',
    onRetry,
}: {
    message?: string
    onRetry?: () => void
}) {
    return (
        <EmptyState
            icon={<HiOutlineExclamationCircle className="w-full h-full text-red-500" />}
            title="Gagal Memuat Data"
            description={message}
            action={onRetry ? {
                label: 'Coba Lagi',
                onClick: onRetry,
            } : undefined}
        />
    )
}

// Empty state for search results
export function EmptySearchResults({ query }: { query: string }) {
    return (
        <EmptyState
            icon={<HiOutlineDocumentText className="w-full h-full" />}
            title="Tidak ada hasil ditemukan"
            description={`Tidak ada hasil yang cocok dengan "${query}". Coba kata kunci yang berbeda.`}
        />
    )
}
