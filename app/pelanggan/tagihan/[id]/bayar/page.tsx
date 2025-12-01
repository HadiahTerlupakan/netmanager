"use client"

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiOutlineArrowLeft,
    HiOutlineCreditCard,
    HiOutlineCheckCircle,
    HiArrowDownTray,
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

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    const [tagihan, setTagihan] = useState<TagihanData | null>(null)
    const [loading, setLoading] = useState(true)
    const [generating, setGenerating] = useState(false)
    const [paymentLink, setPaymentLink] = useState<PaymentLink | null>(null)
    const [selectedGateway, setSelectedGateway] = useState<'xendit' | 'midtrans'>('xendit')
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchTagihan()
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

    const handleGeneratePaymentLink = async () => {
        if (!tagihan) return

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
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-gray-500">Memuat...</div>
            </div>
        )
    }

    if (error && !tagihan) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error}</p>
                    <Link href="/pelanggan/tagihan" className="text-sky-600 hover:text-sky-700">
                        Kembali ke Tagihan
                    </Link>
                </div>
            </div>
        )
    }

    if (!tagihan) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <p className="text-red-500 mb-4">Tagihan tidak ditemukan</p>
                    <Link href="/pelanggan/tagihan" className="text-sky-600 hover:text-sky-700">
                        Kembali ke Tagihan
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/pelanggan/tagihan" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <HiOutlineArrowLeft className="w-6 h-6 text-gray-600" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Pembayaran Tagihan</h1>
                        <p className="text-sm text-gray-500">
                            {tagihan.noTagihan} - {NAMA_BULAN[tagihan.periodeBulan - 1]} {tagihan.periodeTahun}
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Ringkasan Tagihan</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Pelanggan</span>
                            <span className="text-sm font-medium text-gray-900">{tagihan.pelanggan.nama}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Periode</span>
                            <span className="text-sm font-medium text-gray-900">
                                {NAMA_BULAN[tagihan.periodeBulan - 1]} {tagihan.periodeTahun}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Jatuh Tempo</span>
                            <span className="text-sm font-medium text-gray-900">{formatDate(tagihan.jatuhTempo)}</span>
                        </div>
                        <div className="pt-3 border-t border-gray-200 flex justify-between">
                            <span className="text-lg font-bold text-gray-900">Total Pembayaran</span>
                            <span className="text-lg font-bold text-sky-600">{formatRupiah(tagihan.total)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Pilih Metode Pembayaran</h2>
                    <div className="space-y-3">
                        <button
                            onClick={() => setSelectedGateway('xendit')}
                            className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${selectedGateway === 'xendit' ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedGateway === 'xendit' ? 'border-sky-500' : 'border-gray-300'
                                    }`}>
                                    {selectedGateway === 'xendit' && <div className="w-3 h-3 bg-sky-500 rounded-full" />}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">Xendit</p>
                                    <p className="text-sm text-gray-500">Transfer Bank, E-Wallet (OVO, GoPay, DANA), QRIS</p>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => setSelectedGateway('midtrans')}
                            className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${selectedGateway === 'midtrans' ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedGateway === 'midtrans' ? 'border-sky-500' : 'border-gray-300'
                                    }`}>
                                    {selectedGateway === 'midtrans' && <div className="w-3 h-3 bg-sky-500 rounded-full" />}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">Midtrans</p>
                                    <p className="text-sm text-gray-500">Kartu Kredit, Transfer Bank, E-Wallet</p>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                {paymentLink && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <HiOutlineCheckCircle className="w-6 h-6 text-green-600" />
                            <h3 className="text-lg font-semibold text-green-900">Link Pembayaran Berhasil Dibuat!</h3>
                        </div>
                        <p className="text-sm text-green-800 mb-4">
                            Link pembayaran telah dibuka di tab baru. Jika tidak terbuka, klik tombol di bawah:
                        </p>
                        <a
                            href={paymentLink.paymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <HiOutlineCreditCard className="w-5 h-5" />
                            Buka Halaman Pembayaran
                        </a>
                        <p className="text-xs text-green-700 mt-4">
                            Link akan kedaluwarsa pada: {formatDate(paymentLink.expiresAt)}
                        </p>
                    </div>
                )}

                {!paymentLink && (
                    <button
                        onClick={handleGeneratePaymentLink}
                        disabled={generating}
                        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
                    >
                        {generating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Membuat Link Pembayaran...
                            </>
                        ) : (
                            <>
                                <HiOutlineCreditCard className="w-6 h-6" />
                                Bayar Sekarang
                            </>
                        )}
                    </button>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <p className="text-sm text-blue-800">
                        <strong>💡 Catatan:</strong> Setelah pembayaran berhasil, status tagihan akan otomatis diperbarui dalam 1-5 menit.
                        Cek kembali halaman tagihan Anda untuk melihat status terbaru.
                    </p>
                </div>

                <div className="mt-6">
                    <button
                        onClick={async () => {
                            if (!tagihan) return
                            try {
                                const token = localStorage.getItem('pelanggan_token')
                                const pelangganData = localStorage.getItem('pelanggan_data')

                                if (!token || !pelangganData) {
                                    alert('Sesi Anda telah berakhir. Silakan login kembali.')
                                    router.push('/pelanggan/login')
                                    return
                                }

                                const btn = document.activeElement as HTMLButtonElement
                                const originalText = btn.innerText
                                btn.innerText = 'Downloading...'
                                btn.disabled = true

                                const response = await fetch(`/api/tagihan/${tagihan.id}/pdf`, {
                                    headers: {
                                        'x-pelanggan-token': token,
                                        'x-pelanggan-data': pelangganData,
                                    },
                                })

                                if (!response.ok) throw new Error('Gagal mengunduh PDF')

                                const blob = await response.blob()
                                const url = window.URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `Invoice-${tagihan.noTagihan}.pdf`
                                document.body.appendChild(a)
                                a.click()
                                window.URL.revokeObjectURL(url)
                                document.body.removeChild(a)
                            } catch (error) {
                                console.error('Download error:', error)
                                alert('Gagal mengunduh invoice. Silakan coba lagi.')
                            } finally {
                                const btn = document.activeElement as HTMLButtonElement
                                if (btn) {
                                    btn.innerText = 'Download Invoice (PDF)'
                                    btn.disabled = false
                                }
                            }
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors w-full"
                    >
                        <HiArrowDownTray className="w-5 h-5" />
                        Download Invoice (PDF)
                    </button>
                </div>
            </div>
        </div>
    )
}
