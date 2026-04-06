"use client"

import { useState, useEffect } from 'react'
import {
    HiOutlineExclamationCircle,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineClock
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

interface UnmatchedMutation {
    id: string
    provider: string
    transactionId: string | null
    amount: number
    description: string | null
    type: string | null
    date: string
    bankId: string | null
    status: 'PENDING' | 'RESOLVED' | 'IGNORED'
    createdAt: string
}

export default function UnmatchedMutationsList() {
    const [mutations, setMutations] = useState<UnmatchedMutation[]>([])
    const [loading, setLoading] = useState(true)
    const [resolveInvoiceId, setResolveInvoiceId] = useState<{ [key: string]: string }>({})
    const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({})

    useEffect(() => {
        fetchMutations()
    }, [])

    const fetchMutations = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/finance/unmatched-mutations?status=PENDING')
            if (response.ok) {
                const payload = await response.json()
                const nextMutations = Array.isArray(payload?.data) ? payload.data : []
                setMutations(nextMutations)
            }
        } catch (error) {
            console.error('Error fetching unmatched mutations:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (id: string, action: 'RESOLVE' | 'IGNORE') => {
        const invoiceId = resolveInvoiceId[id]
        if (action === 'RESOLVE' && !invoiceId) {
            alert('Masukkan ID Tagihan untuk menyelesaikan mutasi ini.')
            return
        }

        if (action === 'IGNORE' && !confirm('Yakin ingin mengabaikan mutasi ini?')) {
            return
        }

        try {
            setActionLoading(prev => ({ ...prev, [id]: true }))
            const response = await fetch('/api/finance/unmatched-mutations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mutationId: id,
                    action,
                    invoiceId: action === 'RESOLVE' ? invoiceId : undefined
                })
            })

            if (response.ok) {
                alert(`Mutasi berhasil di-${action === 'RESOLVE' ? 'selesaikan' : 'abaikan'}.`)
                fetchMutations()
            } else {
                const error = await response.json()
                alert(`Gagal: ${error.error}`)
            }
        } catch (error) {
            console.error('Action error:', error)
            alert('Terjadi kesalahan sistem')
        } finally {
            setActionLoading(prev => ({ ...prev, [id]: false }))
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <PageLoader />
            </div>
        )
    }

    return (
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <HiOutlineExclamationCircle className="w-6 h-6 text-amber-500" />
                    Mutasi Belum Teridentifikasi
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Daftar transfer masuk dari Payment Gateway (seperti Moota) yang nominalnya tidak cocok dengan tagihan manapun.
                </p>
            </div>

            {mutations.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center border border-gray-200 dark:border-gray-700">
                    <HiOutlineCheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium text-lg">
                        Semua mutasi telah teridentifikasi
                    </p>
                    <p className="text-gray-500 dark:text-gray-500 mt-2">
                        Tidak ada mutasi menggantung yang memerlukan tindakan manual saat ini.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {mutations.map((mutation) => (
                        <div key={mutation.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border-l-4 border-amber-500 overflow-hidden">
                            <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6">
                                {/* Left: Mutation Details */}
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium font-mono">
                                                {mutation.provider}
                                            </span>
                                            {mutation.type && (
                                                <span className={`px-3 py-1 rounded-lg text-sm font-medium ${mutation.type === 'CR' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                    {mutation.type === 'CR' ? 'KREDIT' : mutation.type}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                                            <HiOutlineClock className="w-4 h-4" />
                                            {new Date(mutation.date).toLocaleString('id-ID')}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                                            Rp {Number(mutation.amount).toLocaleString('id-ID')}
                                        </p>
                                        <p className="text-gray-600 dark:text-gray-400 mt-2 font-medium">
                                            {mutation.description || 'Tidak ada deskripsi'}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
                                        <div>
                                            <p className="text-gray-500 dark:text-gray-400 mb-1">Bank Pengirim</p>
                                            <p className="font-medium text-gray-900 dark:text-white">{mutation.bankId || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500 dark:text-gray-400 mb-1">ID Transaksi (Gateway)</p>
                                            <p className="font-medium text-gray-900 dark:text-white font-mono text-xs break-all">{mutation.transactionId || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className="md:w-1/3 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl flex flex-col justify-center space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-2">Tindakan Admin</h3>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Assign ke Tagihan (Invoice ID)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="INV-..."
                                                className="flex-1 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                value={resolveInvoiceId[mutation.id] || ''}
                                                onChange={(e) => setResolveInvoiceId(prev => ({ ...prev, [mutation.id]: e.target.value }))}
                                            />
                                            <button
                                                onClick={() => handleAction(mutation.id, 'RESOLVE')}
                                                disabled={actionLoading[mutation.id] || !resolveInvoiceId[mutation.id]}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {actionLoading[mutation.id] ? 'Proses...' : 'Assign'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative py-2">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                                        </div>
                                        <div className="relative flex justify-center text-sm">
                                            <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500">ATAU</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleAction(mutation.id, 'IGNORE')}
                                        disabled={actionLoading[mutation.id]}
                                        className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                                    >
                                        <HiOutlineXCircle className="w-5 h-5" />
                                        Abaikan Mutasi
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
