"use client"

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiOutlineArrowLeft,
    HiOutlineBanknotes,
    HiOutlineCheckCircle,
    HiArrowUpTray,
} from 'react-icons/hi2'

interface TagihanData {
    id: string
    noTagihan: string
    periodeBulan: number
    periodeTahun: number
    total: number
    pelangganId: string
}

interface BankAccount {
    id: string
    bankName: string
    accountNumber: string
    accountName: string
    description?: string
}

export default function ManualPaymentPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    const [tagihan, setTagihan] = useState<TagihanData | null>(null)
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
    const [selectedBank, setSelectedBank] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [uploadedImage, setUploadedImage] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        senderName: '',
        transferDate: '',
        notes: '',
    })

    useEffect(() => {
        fetchTagihan()
        fetchBankAccounts()
         
    }, [resolvedParams.id])

    const fetchTagihan = async () => {
        try {
            const response = await fetch(`/api/tagihan/${resolvedParams.id}`)
            if (response.ok) {
                const data = await response.json()
                setTagihan(data)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchBankAccounts = async () => {
        try {
            const response = await fetch('/api/company-bank-accounts/active')
            if (response.ok) {
                const data = await response.json()
                setBankAccounts(data)
                if (data.length > 0) {
                    setSelectedBank(data[0].id)
                }
            }
        } catch (error) {
            console.error('Error:', error)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)

        try {
            const response = await fetch('/api/upload/payment-proof', {
                method: 'POST',
                body: formData,
            })

            if (response.ok) {
                const data = await response.json()
                setUploadedImage(data.url)
            } else {
                const error = await response.json()
                alert(error.error || 'Upload gagal')
            }
        } catch (error) {
            console.error('Upload error:', error)
            alert('Gagal mengupload file')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!uploadedImage) {
            alert('Silakan upload bukti transfer terlebih dahulu')
            return
        }

        if (!tagihan) return

        try {
            setSubmitting(true)

            const response = await fetch('/api/manual-payment/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tagihanId: tagihan.id,
                    pelangganId: tagihan.pelangganId,
                    bankAccountId: selectedBank,
                    amount: tagihan.total,
                    senderName: formData.senderName,
                    transferDate: formData.transferDate,
                    proofImageUrl: uploadedImage,
                    notes: formData.notes,
                }),
            })

            if (response.ok) {
                alert('✅ Bukti transfer berhasil disubmit! Menunggu verifikasi admin.')
                router.push('/pelanggan/tagihan')
            } else {
                const error = await response.json()
                alert(error.error || 'Gagal submit')
            }
        } catch (error) {
            console.error('Submit error:', error)
            alert('Terjadi kesalahan')
        } finally {
            setSubmitting(false)
        }
    }

    const formatRupiah = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-gray-500 dark:text-gray-400">Memuat...</div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <Link
                        href={`/pelanggan/tagihan/${resolvedParams.id}/bayar`}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <HiOutlineArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transfer Manual</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Upload bukti transfer pembayaran
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <main className="max-w-4xl mx-auto p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Tagihan Info */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Info Tagihan</h2>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">No. Tagihan:</span>
                                <span className="font-medium text-gray-900 dark:text-white">{tagihan?.noTagihan}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Total Bayar:</span>
                                <span className="text-xl font-bold text-sky-600 dark:text-sky-400">
                                    {tagihan && formatRupiah(tagihan.total)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Bank Selection */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Rekening Tujuan Transfer
                        </h2>
                        <div className="space-y-3">
                            {bankAccounts.map((bank) => (
                                <button
                                    key={bank.id}
                                    type="button"
                                    onClick={() => setSelectedBank(bank.id)}
                                    className={`w-full text-left p-4 border-2 rounded-lg transition-all ${selectedBank === bank.id
                                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <HiOutlineBanknotes className={`w-6 h-6 ${selectedBank === bank.id ? 'text-sky-600' : 'text-gray-400'
                                            }`} />
                                        <div className="flex-1">
                                            <div className="font-semibold text-gray-900 dark:text-white">{bank.bankName}</div>
                                            <div className="text-sm text-gray-600 dark:text-gray-400">{bank.accountName}</div>
                                        </div>
                                        {selectedBank === bank.id && (
                                            <HiOutlineCheckCircle className="w-6 h-6 text-sky-600" />
                                        )}
                                    </div>
                                    <div className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                                        {bank.accountNumber}
                                    </div>
                                    {bank.description && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{bank.description}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Transfer Details */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Detail Transfer</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Nama Pengirim *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.senderName}
                                    onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                                    placeholder="Nama sesuai rekening pengirim"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Tanggal Transfer *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.transferDate}
                                    onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Catatan (Opsional)
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Catatan tambahan..."
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Upload Proof */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Upload Bukti Transfer *
                        </h2>
                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
                            {uploadedImage ? (
                                <div className="text-center">
                                    <img
                                        src={uploadedImage}
                                        alt="Bukti Transfer"
                                        className="max-h-64 mx-auto rounded-lg mb-4"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setUploadedImage(null)}
                                        className="text-red-600 hover:underline text-sm"
                                    >
                                        Hapus & Upload Ulang
                                    </button>
                                </div>
                            ) : (
                                <label className="cursor-pointer flex flex-col items-center">
                                    <HiArrowUpTray className="w-12 h-12 text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        Klik untuk upload (JPG/PNG, max 5MB)
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting || !uploadedImage}
                        className="w-full px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Mengirim...
                            </>
                        ) : (
                            <>
                                <HiOutlineCheckCircle className="w-5 h-5" />
                                Submit Bukti Transfer
                            </>
                        )}
                    </button>
                </form>
            </main>
        </div>
    )
}
