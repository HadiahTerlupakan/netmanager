"use client"

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    HiOutlineArrowLeft,
    HiOutlineClock,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiArrowDownTray,
    HiOutlinePaperAirplane,
    HiOutlineCurrencyDollar,
} from 'react-icons/hi2'

type TagihanStatus = 'BELUM_LUNAS' | 'LUNAS' | 'TERLAMBAT'

interface TagihanDetail {
    id: string
    noTagihan: string
    periodeBulan: number
    periodeTahun: number
    subtotal: number
    diskon: number
    ppn: number
    biayaInstalasi: number
    biayaSewaPerangkat: number
    biayaLainnya: number
    total: number
    status: TagihanStatus
    jatuhTempo: string
    tanggalBayar: string | null
    metodePembayaran: string | null
    catatan: string | null
    createdAt: string
    pelanggan: {
        id: string
        idPelanggan: string
        nama: string
        alamat: string | null
        noTelp: string | null
        email: string | null
        hargaPaket: {
            name: string
            harga: number
        }
    }
}

export default function TagihanDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    const [tagihan, setTagihan] = useState<TagihanDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [showBayarForm, setShowBayarForm] = useState(false)
    const [metodePembayaran, setMetodePembayaran] = useState('')
    const [catatan, setCatatan] = useState('')

    useEffect(() => {
        fetchTagihan()
    }, [resolvedParams.id])

    const fetchTagihan = async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/tagihan/${resolvedParams.id}`)
            if (!response.ok) throw new Error('Failed to fetch tagihan')

            const data = await response.json()
            setTagihan(data)
        } catch (error) {
            console.error('Error fetching tagihan:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleBayar = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!metodePembayaran) {
            alert('Pilih metode pembayaran')
            return
        }

        if (!confirm('Konfirmasi pembayaran tagihan ini?')) {
            return
        }

        try {
            setUpdating(true)
            const response = await fetch(`/api/tagihan/${resolvedParams.id}/bayar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    metodePembayaran,
                    catatan,
                }),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to update payment')
            }

            alert('Pembayaran berhasil dicatat!')
            setShowBayarForm(false)
            fetchTagihan() // Refresh data
        } catch (error: any) {
            alert(error.message || 'Gagal mencatat pembayaran')
        } finally {
            setUpdating(false)
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

    const getStatusBadge = (status: TagihanStatus) => {
        const styles = {
            LUNAS: 'bg-green-100 text-green-800',
            BELUM_LUNAS: 'bg-yellow-100 text-yellow-800',
            TERLAMBAT: 'bg-red-100 text-red-800',
        }

        const icons = {
            LUNAS: HiOutlineCheckCircle,
            BELUM_LUNAS: HiOutlineClock,
            TERLAMBAT: HiOutlineXCircle,
        }

        const labels = {
            LUNAS: 'Lunas',
            BELUM_LUNAS: 'Belum Lunas',
            TERLAMBAT: 'Terlambat',
        }

        const Icon = icons[status]

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${styles[status]}`}>
                <Icon className="w-5 h-5" />
                {labels[status]}
            </span>
        )
    }

    const NAMA_BULAN = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-gray-500">Memuat data...</div>
            </div>
        )
    }

    if (!tagihan) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <p className="text-red-500 mb-4">Tagihan tidak ditemukan</p>
                    <Link
                        href="/admin/finance/tagihan"
                        className="text-sky-600 hover:text-sky-700"
                    >
                        Kembali ke daftar tagihan
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/finance/tagihan"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <HiOutlineArrowLeft className="w-6 h-6 text-gray-600" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">{tagihan.noTagihan}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {NAMA_BULAN[tagihan.periodeBulan - 1]} {tagihan.periodeTahun}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {getStatusBadge(tagihan.status)}
                    {tagihan.status !== 'LUNAS' && (
                        <button
                            onClick={() => setShowBayarForm(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                            Catat Pembayaran
                        </button>
                    )}
                </div>
            </div>

            {/* Payment Form */}
            {
                showBayarForm && tagihan.status !== 'LUNAS' && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Catat Pembayaran Manual</h3>
                        <form onSubmit={handleBayar} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Metode Pembayaran *
                                </label>
                                <select
                                    value={metodePembayaran}
                                    onChange={(e) => setMetodePembayaran(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    required
                                >
                                    <option value="">Pilih metode pembayaran</option>
                                    <option value="CASH">Tunai</option>
                                    <option value="TRANSFER">Transfer Bank</option>
                                    <option value="OVO">OVO</option>
                                    <option value="GOPAY">GoPay</option>
                                    <option value="DANA">DANA</option>
                                    <option value="QRIS">QRIS</option>
                                    <option value="LAINNYA">Lainnya</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Catatan (Opsional)
                                </label>
                                <textarea
                                    value={catatan}
                                    onChange={(e) => setCatatan(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                    placeholder="Contoh: Transfer dari BCA rek xxx-xxx"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={updating}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                                >
                                    {updating ? 'Menyimpan...' : 'Simpan Pembayaran'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowBayarForm(false)}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Batal
                                </button>
                            </div>
                        </form>
                    </div>
                )
            }

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Invoice Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Invoice Info */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Detail Tagihan</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-500">Nomor Tagihan</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{tagihan.noTagihan}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Periode</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">
                                    {NAMA_BULAN[tagihan.periodeBulan - 1]} {tagihan.periodeTahun}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Jatuh Tempo</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(tagihan.jatuhTempo)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Dibuat</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{formatDate(tagihan.createdAt)}</p>
                            </div>
                            {tagihan.tanggalBayar && (
                                <>
                                    <div>
                                        <p className="text-xs text-gray-500">Tanggal Bayar</p>
                                        <p className="text-sm font-medium text-green-600 mt-1">{formatDate(tagihan.tanggalBayar)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Metode Pembayaran</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{tagihan.metodePembayaran || '-'}</p>
                                    </div>
                                </>
                            )}
                        </div>
                        {tagihan.catatan && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <p className="text-xs text-gray-500">Catatan</p>
                                <p className="text-sm text-gray-900 mt-1">{tagihan.catatan}</p>
                            </div>
                        )}
                    </div>

                    {/* Breakdown */}
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rincian Biaya</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Paket - {tagihan.pelanggan.hargaPaket.name}</span>
                                <span className="text-sm font-medium text-gray-900">{formatRupiah(tagihan.subtotal)}</span>
                            </div>
                            {tagihan.biayaInstalasi > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Biaya Instalasi</span>
                                    <span className="text-sm font-medium text-gray-900">{formatRupiah(tagihan.biayaInstalasi)}</span>
                                </div>
                            )}
                            {tagihan.biayaSewaPerangkat > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Sewa Perangkat</span>
                                    <span className="text-sm font-medium text-gray-900">{formatRupiah(tagihan.biayaSewaPerangkat)}</span>
                                </div>
                            )}
                            {tagihan.biayaLainnya > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Biaya Lainnya</span>
                                    <span className="text-sm font-medium text-gray-900">{formatRupiah(tagihan.biayaLainnya)}</span>
                                </div>
                            )}
                            {tagihan.diskon > 0 && (
                                <div className="flex justify-between text-green-600">
                                    <span className="text-sm">Diskon</span>
                                    <span className="text-sm font-medium">-{formatRupiah(tagihan.diskon)}</span>
                                </div>
                            )}
                            {tagihan.ppn > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">PPN</span>
                                    <span className="text-sm font-medium text-gray-900">{formatRupiah(tagihan.ppn)}</span>
                                </div>
                            )}
                            <div className="pt-3 border-t border-gray-200 flex justify-between">
                                <span className="text-lg font-bold text-gray-900">Total</span>
                                <span className="text-lg font-bold text-gray-900">{formatRupiah(tagihan.total)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Customer Info */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pelanggan</h2>
                        <div className="space-y-3">
                            <div>
                                <p className="text-xs text-gray-500">Nama</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{tagihan.pelanggan.nama}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">ID Pelanggan</p>
                                <p className="text-sm font-medium text-gray-900 mt-1">{tagihan.pelanggan.idPelanggan}</p>
                            </div>
                            {tagihan.pelanggan.alamat && (
                                <div>
                                    <p className="text-xs text-gray-500">Alamat</p>
                                    <p className="text-sm text-gray-900 mt-1">{tagihan.pelanggan.alamat}</p>
                                </div>
                            )}
                            {tagihan.pelanggan.noTelp && (
                                <div>
                                    <p className="text-xs text-gray-500">No. Telepon</p>
                                    <p className="text-sm text-gray-900 mt-1">{tagihan.pelanggan.noTelp}</p>
                                </div>
                            )}
                            {tagihan.pelanggan.email && (
                                <div>
                                    <p className="text-xs text-gray-500">Email</p>
                                    <p className="text-sm text-gray-900 mt-1">{tagihan.pelanggan.email}</p>
                                </div>
                            )}
                            <div className="pt-3 border-t border-gray-200">
                                <Link
                                    href={`/admin/ftth/pelanggan/${tagihan.pelanggan.id}`}
                                    className="text-sm text-sky-600 hover:text-sky-700 font-medium"
                                >
                                    Lihat Detail Pelanggan →
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    )
}
