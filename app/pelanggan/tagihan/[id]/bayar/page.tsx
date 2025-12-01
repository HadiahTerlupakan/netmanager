"use client"

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiOutlineArrowLeft,
    HiOutlineCreditCard,
    HiOutlineCheckCircle,
    HiArrowDownTray,
    HiOutlineBanknotes,
} from 'react-icons/hi2'

interface TagihanData {
    id: string
    noTagihan: string
    periodeBulan: number
    periodeTahun: number
    total: number
    status: string
    jatuhTempo: string
    pelanggan: {
        nama: string
        email: string | null
        noTelp: string | null
    }
}

interface PaymentLink {
    paymentUrl: string
    transactionId: string
    expiresAt: string
}

interface PaymentGateway {
    id: string
    name: string
    provider: string
    priority: number
}

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    const [tagihan, setTagihan] = useState<TagihanData | null>(null)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [paymentLink, setPaymentLink] = useState<PaymentLink | null>(null)
    const [availableGateways, setAvailableGateways] = useState<PaymentGateway[]>([])
    const [selectedGateway, setSelectedGateway] = useState<string>('')
    const [error, setError] = useState<string | null>(null)
    const [hasActiveBankAccounts, setHasActiveBankAccounts] = useState<boolean>(false)

    useEffect(() => {
        fetchTagihan()
        fetchAvailableGateways()
        checkActiveBankAccounts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedParams.id])

    const fetchTagihan = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/tagihan/${resolvedParams.id}`)
            if (!response.ok) throw new Error('Failed to fetch tagihan')

            const data = await response.json()

            if (data.status === 'LUNAS') {
                router.push('/pelanggan/tagihan')
                return
            }

            setTagihan(data)
        } catch (error) {
            console.error('Error fetching tagihan:', error)
            setError('Gagal memuat data tagihan')
        } finally {
            setLoading(false)
        }
    }

    const fetchAvailableGateways = async () => {
        try {
            const response = await fetch('/api/payment/gateways')
            if (response.ok) {
                const gateways = await response.json()
                setAvailableGateways(gateways)
                if (gateways.length > 0 && !selectedGateway) {
                    setSelectedGateway(gateways[0].id)
                }
            }
        } catch (error) {
            console.error('Error fetching gateways:', error)
        }
    }

    const checkActiveBankAccounts = async () => {
        try {
            const response = await fetch('/api/company-bank-accounts/active', {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache',
                },
            })
            if (response.ok) {
                const accounts = await response.json()
                setHasActiveBankAccounts(accounts.length > 0)
            }
        } catch (error) {
            console.error('Error checking bank accounts:', error)
            setHasActiveBankAccounts(false)
        }
    }

    const handleGeneratePaymentLink = async () => {
        if (!tagihan || !selectedGateway) return

        try {
            setGenerating(true)
            setError(null)

            const response = await fetch(`/api/payment/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tagihanId: tagihan.id,
                    preferredProvider: selectedGateway,
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to generate payment link')
            }

            const data = await response.json()
            setPaymentLink(data)

            if (data.paymentUrl) {
                window.open(data.paymentUrl, '_blank')
            }
        } catch (error: any) {
            console.error('Error generating payment link:', error)
            setError(error.message || 'Gagal membuat link pembayaran')
        } finally {
            setGenerating(false)
        }
    }

    const handleDownloadInvoice = async () => {
        if (!tagihan) return
        try {
            const token = localStorage.getItem('pelanggan_token')
            const response = await fetch(`/api/tagihan/${tagihan.id}/pdf`, {
                headers: {
                    'x-pelanggan-token': token || '',
                },
            })

            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `invoice-${tagihan.noTagihan}.pdf`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
            }
        } catch (err) {
            console.error('Error downloading invoice:', err)
        }
    }

    const formatRupiah = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(amount)
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
    }

    const NAMA_BULAN = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-gray-500 dark:text-gray-400">Memuat...</div>
            </div>
        )
    }

    if (error && !tagihan) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
                    <Link href="/pelanggan/tagihan" className="text-sky-600 dark:text-sky-400 hover:underline">
                        Kembali ke Tagihan
                    </Link>
                </div>
            </div>
        )
    }

    if (!tagihan) {
        return null
    }

    return (
        <>
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <div className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                    <div className="px-4 md:px-6 lg:px-8 py-4">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/pelanggan/tagihan"
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <HiOutlineArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pembayaran</h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {NAMA_BULAN[tagihan.periodeBulan - 1]} {tagihan.periodeTahun}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <main className="px-4 py-6 md:px-6 lg:px-8 max-w-4xl mx-auto">
                    {error && (
                        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Bill Summary */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Detail Tagihan</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">No. Tagihan</span>
                                <span className="font-medium text-gray-900 dark:text-white">{tagihan.noTagihan}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Periode</span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {NAMA_BULAN[tagihan.periodeBulan - 1]} {tagihan.periodeTahun}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600 dark:text-gray-400">Jatuh Tempo</span>
                                <span className="font-medium text-gray-900 dark:text-white">{formatDate(tagihan.jatuhTempo)}</span>
                            </div>
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                                <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                                    {formatRupiah(tagihan.total)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Gateway Selection */}
                    {availableGateways.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Gateway</h2>
                            <div className={`grid gap-3 ${availableGateways.length === 1 ? 'grid-cols-1' :
                                    availableGateways.length === 2 ? 'grid-cols-2' :
                                        'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                                }`}>
                                {availableGateways.map((gateway) => (
                                    <button
                                        key={gateway.id}
                                        onClick={() => setSelectedGateway(gateway.id)}
                                        className={`p-3 border-2 rounded-xl transition-all ${selectedGateway === gateway.id
                                                ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                    >
                                        <HiOutlineCreditCard className={`w-6 h-6 mx-auto mb-1 ${selectedGateway === gateway.id ? 'text-sky-600 dark:text-sky-400' : 'text-gray-400'
                                            }`} />
                                        <p className={`text-xs font-medium ${selectedGateway === gateway.id
                                                ? 'text-sky-600 dark:text-sky-400'
                                                : 'text-gray-700 dark:text-gray-300'
                                            }`}>
                                            {gateway.name}
                                        </p>
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={handleGeneratePaymentLink}
                                disabled={generating || !selectedGateway}
                                className="w-full mt-4 px-6 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                            >
                                {generating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Membuat...
                                    </>
                                ) : (
                                    <>
                                        <HiOutlineCreditCard className="w-5 h-5" />
                                        Bayar dengan Payment Gateway
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Manual Transfer Option - Only show if there are active bank accounts */}
                    {hasActiveBankAccounts && (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-6 mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Transfer Manual</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Transfer langsung ke rekening bank perusahaan dan upload bukti transfer
                            </p>
                            <Link
                                href={`/pelanggan/tagihan/${resolvedParams.id}/manual-payment`}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
                            >
                                <HiOutlineBanknotes className="w-5 h-5" />
                                Upload Bukti Transfer
                            </Link>
                        </div>
                    )}

                    {/* Payment Link Result */}
                    {paymentLink && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <HiOutlineCheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                                <h3 className="text-lg font-semibold text-green-900 dark:text-green-400">Link Pembayaran Dibuat!</h3>
                            </div>
                            <p className="text-sm text-green-800 dark:text-green-400 mb-4">
                                Link pembayaran telah dibuat dan dibuka di tab baru. Silakan selesaikan pembayaran Anda.
                            </p>
                            <a
                                href={paymentLink.paymentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                            >
                                Buka Link Pembayaran
                            </a>
                        </div>
                    )}

                    {/* Download Invoice */}
                    <button
                        onClick={handleDownloadInvoice}
                        className="w-full px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                        <HiArrowDownTray className="w-5 h-5" />
                        Download Invoice
                    </button>
                </main>
            </div>
        </>
    )
}
