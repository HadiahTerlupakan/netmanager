'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { HiOutlineDocumentText, HiOutlineArrowUturnLeft } from 'react-icons/hi2'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils'
import { cancelCustomerPayment, fetchCustomerInvoices } from './customerInvoiceHistoryApi'

type InvoiceStatus = 'SENT' | 'OVERDUE' | 'PAID' | 'PARTIAL_PAID' | 'CANCELLED' | string

type InvoicePaymentStatus = 'PAID' | 'PENDING' | 'CANCELLED' | string

interface InvoicePayment {
    id: string
    amount: number
    createdAt: string
    paymentMethod?: string | null
    gatewayStatus: InvoicePaymentStatus
    notes?: string | null
}

interface CustomerInvoiceHistoryItem {
    id: string
    invoiceNumber?: string | null
    createdAt: string
    dueDate: string
    totalAmount: number
    status: InvoiceStatus
    payment?: InvoicePayment[] | null
}

interface CustomerInvoicesResponse {
    success: boolean
    data?: unknown
    error?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isInvoicePayment = (value: unknown): value is InvoicePayment => {
    if (!isRecord(value)) return false
    return typeof value.id === 'string' &&
        typeof value.amount === 'number' &&
        typeof value.createdAt === 'string' &&
        typeof value.gatewayStatus === 'string'
}

const isCustomerInvoiceHistoryItem = (value: unknown): value is CustomerInvoiceHistoryItem => {
    if (!isRecord(value)) return false
    const payment = value.payment
    return typeof value.id === 'string' &&
        typeof value.createdAt === 'string' &&
        typeof value.dueDate === 'string' &&
        typeof value.totalAmount === 'number' &&
        typeof value.status === 'string' &&
        (value.invoiceNumber === undefined || value.invoiceNumber === null || typeof value.invoiceNumber === 'string') &&
        (payment === undefined || payment === null || (Array.isArray(payment) && payment.every(isInvoicePayment)))
}

const parseCustomerInvoices = (response: CustomerInvoicesResponse): CustomerInvoiceHistoryItem[] => {
    if (!response.success || !Array.isArray(response.data)) {
        return []
    }

    return response.data.filter(isCustomerInvoiceHistoryItem)
}

export default function CustomerInvoiceHistory({ pelangganId }: { pelangganId: string }) {
    const router = useRouter()
    const [invoices, setInvoices] = useState<CustomerInvoiceHistoryItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchInvoices = useCallback(async () => {
        setIsLoading(true)
        setError(null)
        try {
            const response = (await fetchCustomerInvoices(pelangganId)) as CustomerInvoicesResponse
            const parsedInvoices = parseCustomerInvoices(response)

            if (response.success) {
                setInvoices(parsedInvoices)
                if (Array.isArray(response.data) && response.data.length > parsedInvoices.length) {
                    setError('Sebagian data tagihan tidak dapat ditampilkan.')
                }
            } else {
                setError(response.error || 'Gagal memuat data tagihan.')
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.'
            setError(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }, [pelangganId])

    useEffect(() => {
        fetchInvoices()
    }, [fetchInvoices])

    const [cancellingPaymentId, setCancellingPaymentId] = useState<string | null>(null)
    const [isCancelling, setIsCancelling] = useState(false)

    const handleCancelClick = (paymentId: string) => {
        setCancellingPaymentId(paymentId)
    }

    const confirmCancelPayment = async () => {
        if (!cancellingPaymentId) return

        setIsCancelling(true)
        try {
            const result = await cancelCustomerPayment(cancellingPaymentId)
            if (result.success) {
                toast.success('Pembayaran berhasil dibatalkan.')
                // Refresh data
                await fetchInvoices()
                router.refresh()
            } else {
                toast.error(result.error || 'Gagal membatalkan pembayaran.')
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.'
            toast.error(errorMessage)
        } finally {
            setIsCancelling(false)
            setCancellingPaymentId(null)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="bg-white dark:bg-gray-900 shadow-sm sm:rounded-xl border border-gray-200 dark:border-gray-800 mt-8">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
                <HiOutlineDocumentText className="w-6 h-6 text-indigo-500" />
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                    VI. Riwayat Tagihan & Pembayaran
                </h3>
            </div>

            <div className="p-4 sm:p-6 overflow-x-auto">
                {isLoading ? (
                    <div className="flex justify-center p-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                    </div>
                ) : error ? (
                    <div className="text-red-500 text-sm">Gagal memuat data tagihan.</div>
                ) : invoices.length === 0 ? (
                    <div className="text-gray-500 text-center py-6">Belum ada riwayat tagihan.</div>
                ) : (
                    <div className="space-y-6">
                        {invoices.map((invoice) => (
                            <div key={invoice.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                                            {invoice.invoiceNumber || 'INV-XXX'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Dibuat: {formatDate(invoice.createdAt)} | Jatuh Tempo: {formatDate(invoice.dueDate)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-xs text-gray-500">Total Tagihan</div>
                                            <div className="font-bold text-gray-900 dark:text-white font-mono">
                                                {formatCurrency(invoice.totalAmount)}
                                            </div>
                                        </div>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${invoice.status === 'PAID' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' :
                                            invoice.status === 'OVERDUE' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' :
                                                invoice.status === 'SENT' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' :
                                                    invoice.status === 'CANCELLED' ? 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300 dark:border-gray-600' :
                                                        'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
                                            }`}>
                                            {invoice.status === 'SENT' ? 'Terkirim' :
                                                invoice.status === 'OVERDUE' ? 'Jatuh Tempo' :
                                                    invoice.status === 'PAID' ? 'Lunas' :
                                                        invoice.status === 'PARTIAL_PAID' ? 'Bayar Sebagian' :
                                                            invoice.status === 'CANCELLED' ? 'Dibatalkan' : invoice.status}
                                        </span>
                                    </div>
                                </div>

                                {invoice.payment && invoice.payment.length > 0 && (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {invoice.payment.map((payment) => (
                                            <div key={payment.id} className="p-4 flex flex-col sm:flex-row justify-between items-center sm:items-start gap-3 bg-white dark:bg-gray-900">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                                                        <span>Pembayaran ({payment.paymentMethod || 'Manual'})</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${payment.gatewayStatus === 'PAID' ? 'bg-green-100 text-green-800' :
                                                            payment.gatewayStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                                payment.gatewayStatus === 'CANCELLED' ? 'bg-gray-100 text-gray-800' :
                                                                    'bg-red-100 text-red-800'
                                                            }`}>
                                                            {payment.gatewayStatus}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {formatDate(payment.createdAt)}
                                                    </div>
                                                    {payment.notes && (
                                                        <div className="text-xs text-gray-500 mt-1 italic">
                                                            Catatan: {payment.notes}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className="font-bold text-green-600 dark:text-green-400 font-mono">
                                                        + {formatCurrency(payment.amount)}
                                                    </div>

                                                    {payment.gatewayStatus === 'PAID' && (
                                                        <button
                                                            onClick={() => handleCancelClick(payment.id)}
                                                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                            title="Batalkan Pembayaran"
                                                        >
                                                            <HiOutlineArrowUturnLeft className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                isOpen={!!cancellingPaymentId}
                onClose={() => !isCancelling && setCancellingPaymentId(null)}
                title="Konfirmasi Pembatalan Pembayaran"
            >
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Apakah Anda yakin ingin membatalkan pembayaran ini?
                    </p>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800 rounded-lg">
                        <ul className="list-disc pl-5 text-sm text-red-700 dark:text-red-400 space-y-1">
                            <li>Tagihan ini akan kembali berstatus <strong>Belum Lunas (Unpaid)</strong>.</li>
                            <li>Status pelanggan akan <strong>otomatis menjadi ISOLIR</strong>.</li>
                            <li>Tindakan ini tidak dapat dibatalkan (undo).</li>
                        </ul>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            variant="destructive"
                            disabled={isCancelling}
                            onClick={() => setCancellingPaymentId(null)}
                        >
                            Batal
                        </Button>
                        <Button
                            loading={isCancelling}
                            onClick={confirmCancelPayment}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Ya, Batalkan Pembayaran
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
