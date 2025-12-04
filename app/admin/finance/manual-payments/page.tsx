"use client"

import { useState, useEffect } from 'react'
import {
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineClock,
    HiOutlineEye,
    HiXMark,
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

interface ManualPayment {
    id: string
    amount: string
    senderName: string
    transferDate: string
    proofImageUrl: string
    notes?: string
    status: string
    createdAt: string
    rejectionReason?: string
    tagihan: {
        noTagihan: string
        total: number
    }
    pelanggan: {
        nama: string
        email?: string
        noTelp?: string
    }
    bankAccount: {
        bankName: string
        accountNumber: string
        accountName: string
    }
}

export default function ManualPaymentsPage() {
    const [payments, setPayments] = useState<ManualPayment[]>([])
    const [filter, setFilter] = useState<string>('PENDING')
    const [loading, setLoading] = useState(true)
    const [selectedPayment, setSelectedPayment] = useState<ManualPayment | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [rejectionReason, setRejectionReason] = useState('')

    useEffect(() => {
        fetchPayments()
    }, [filter])

    const fetchPayments = async () => {
        try {
            setLoading(true)
            const url = filter ? `/api/admin/manual-payments?status=${filter}` : '/api/admin/manual-payments'
            const response = await fetch(url)
            if (response.ok) {
                const data = await response.json()
                setPayments(data)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleApprove = async (id: string) => {
        if (!confirm('Approve pembayaran ini?')) return

        try {
            const response = await fetch(`/api/admin/manual-payments/${id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ verifiedBy: 'admin' }),
            })

            if (response.ok) {
                alert('✅ Pembayaran approved! Tagihan menjadi LUNAS.')
                fetchPayments()
                setModalOpen(false)
            }
        } catch (error) {
            alert('Gagal approve')
        }
    }

    const handleReject = async (id: string) => {
        if (!rejectionReason.trim()) {
            alert('Alasan penolakan harus diisi')
            return
        }

        try {
            const response = await fetch(`/api/admin/manual-payments/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rejectionReason, verifiedBy: 'admin' }),
            })

            if (response.ok) {
                alert('❌ Pembayaran rejected')
                setRejectionReason('')
                fetchPayments()
                setModalOpen(false)
            }
        } catch (error) {
            alert('Gagal reject')
        }
    }

    const formatRupiah = (amount: string | number) => {
        const num = typeof amount === 'string' ? parseInt(amount) : amount
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(num)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Verifikasi Pembayaran Manual
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Review dan verifikasi bukti transfer dari pelanggan
                </p>
            </div>

            {/* Filter Tabs */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                    {['PENDING', 'APPROVED', 'REJECTED'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 font-medium transition-colors ${filter === status
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            {status === 'PENDING' && '⏳ Pending'}
                            {status === 'APPROVED' && '✅ Approved'}
                            {status === 'REJECTED' && '❌ Rejected'}
                            <span className="ml-2 text-xs">
                                ({payments.filter((p) => p.status === status).length})
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Payments List */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <PageLoader variant="section" />
                ) : payments.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
                        <p className="text-gray-500 dark:text-gray-400">Tidak ada data</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {payments.map((payment) => (
                            <div
                                key={payment.id}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                {payment.pelanggan.nama}
                                            </h3>
                                            {payment.status === 'PENDING' && (
                                                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 rounded">
                                                    Pending
                                                </span>
                                            )}
                                            {payment.status === 'APPROVED' && (
                                                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded">
                                                    Approved
                                                </span>
                                            )}
                                            {payment.status === 'REJECTED' && (
                                                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 rounded">
                                                    Rejected
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">No. Tagihan:</span>
                                                <p className="font-medium text-gray-900 dark:text-white">{payment.tagihan.noTagihan}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Jumlah:</span>
                                                <p className="font-bold text-sky-600 dark:text-sky-400">{formatRupiah(payment.amount)}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Pengirim:</span>
                                                <p className="font-medium text-gray-900 dark:text-white">{payment.senderName}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Tgl Transfer:</span>
                                                <p className="font-medium text-gray-900 dark:text-white">{formatDate(payment.transferDate)}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Bank:</span>
                                                <p className="font-medium text-gray-900 dark:text-white">{payment.bankAccount.bankName}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Rek:</span>
                                                <p className="font-mono text-sm font-medium text-gray-900 dark:text-white">{payment.bankAccount.accountNumber}</p>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 dark:text-gray-400">Submit:</span>
                                                <p className="text-gray-900 dark:text-white">{formatDate(payment.createdAt)}</p>
                                            </div>
                                        </div>
                                        {payment.rejectionReason && (
                                            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                                <p className="text-sm text-red-800 dark:text-red-400">
                                                    <strong>Alasan Reject:</strong> {payment.rejectionReason}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedPayment(payment)
                                            setModalOpen(true)
                                        }}
                                        className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                    >
                                        <HiOutlineEye className="w-5 h-5" />
                                        Detail
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {modalOpen && selectedPayment && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Detail Pembayaran</h3>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                            >
                                <HiXMark className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Bukti Transfer */}
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Bukti Transfer</h4>
                                <img
                                    src={selectedPayment.proofImageUrl}
                                    alt="Bukti Transfer"
                                    className="max-w-full max-h-96 mx-auto border border-gray-300 dark:border-gray-600 rounded-lg"
                                />
                            </div>

                            {/* Notes */}
                            {selectedPayment.notes && (
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Catatan Customer</h4>
                                    <p className="text-gray-700 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        {selectedPayment.notes}
                                    </p>
                                </div>
                            )}

                            {/* Actions for Pending */}
                            {selectedPayment.status === 'PENDING' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Alasan Penolakan (jika reject)
                                        </label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Tulis alasan jika menolak..."
                                            rows={3}
                                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        />
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => handleReject(selectedPayment.id)}
                                            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <HiOutlineXCircle className="w-5 h-5" />
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApprove(selectedPayment.id)}
                                            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <HiOutlineCheckCircle className="w-5 h-5" />
                                            Approve & Mark as Paid
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
