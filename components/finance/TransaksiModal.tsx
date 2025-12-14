'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import { HiOutlineBanknotes } from 'react-icons/hi2'

interface TransaksiModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    transaksiId: string | null
    transaksiType: 'pemasukan' | 'pengeluaran' | null
}

const KATEGORI_PEMASUKAN = [
    'Tagihan Pelanggan',
    'Instalasi Baru',
    'Perpanjangan',
    'Denda',
    'Lainnya'
]

const KATEGORI_PENGELUARAN = [
    'Gaji',
    'Listrik',
    'Sewa',
    'Peralatan',
    'Operasional',
    'Maintenance',
    'Lainnya'
]

const METODE_BAYAR = [
    'Cash',
    'Transfer Bank',
    'QRIS',
    'E-Wallet'
]

export default function TransaksiModal({
    isOpen,
    onClose,
    onSuccess,
    transaksiId,
    transaksiType
}: TransaksiModalProps) {
    const [loading, setLoading] = useState(false)
    const [loadingData, setLoadingData] = useState(false)
    const [type, setType] = useState<'pemasukan' | 'pengeluaran'>('pengeluaran')
    const [formData, setFormData] = useState({
        tanggal: new Date().toISOString().split('T')[0],
        jumlah: '',
        kategori: '',
        tipePengeluaran: 'OPEX',
        deskripsi: '',
        metodeBayar: 'Cash',
        referensi: ''
    })

    useEffect(() => {
        if (isOpen) {
            if (transaksiId && transaksiType) {
                // Edit mode
                setType(transaksiType)
                loadTransaksi()
            } else {
                // Create mode - reset form
                setFormData({
                    tanggal: new Date().toISOString().split('T')[0],
                    jumlah: '',
                    kategori: '',
                    tipePengeluaran: 'OPEX',
                    deskripsi: '',
                    metodeBayar: 'Cash',
                    referensi: ''
                })
            }
        }
    }, [isOpen, transaksiId, transaksiType])

    const loadTransaksi = async () => {
        if (!transaksiId || !transaksiType) return
        setLoadingData(true)
        try {
            const endpoint = transaksiType === 'pengeluaran'
                ? `/api/pengeluaran/${transaksiId}`
                : `/api/pemasukan/${transaksiId}`
            const res = await fetch(endpoint)
            if (res.ok) {
                const data = await res.json()
                setFormData({
                    tanggal: new Date(data.tanggal).toISOString().split('T')[0],
                    jumlah: String(data.jumlah),
                    kategori: data.kategori || '',
                    tipePengeluaran: data.tipePengeluaran || 'OPEX',
                    deskripsi: data.deskripsi || '',
                    metodeBayar: data.metodeBayar || 'Cash',
                    referensi: data.referensi || ''
                })
            }
        } catch (error) {
            console.error('Error loading transaksi:', error)
        } finally {
            setLoadingData(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const payload = {
                tanggal: new Date(formData.tanggal),
                jumlah: Number(formData.jumlah),
                kategori: formData.kategori,
                deskripsi: formData.deskripsi,
                metodeBayar: formData.metodeBayar,
                referensi: formData.referensi,
                ...(type === 'pengeluaran' && { tipePengeluaran: formData.tipePengeluaran })
            }

            let endpoint: string
            let method: string

            if (transaksiId) {
                // Update
                endpoint = type === 'pengeluaran'
                    ? `/api/pengeluaran/${transaksiId}`
                    : `/api/pemasukan/${transaksiId}`
                method = 'PUT'
            } else {
                // Create
                endpoint = type === 'pengeluaran' ? '/api/pengeluaran' : '/api/pemasukan'
                method = 'POST'
            }

            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })

            if (res.ok) {
                onSuccess()
                onClose()
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal menyimpan transaksi')
            }
        } catch (error) {
            console.error('Error saving transaksi:', error)
            alert('Terjadi kesalahan saat menyimpan')
        } finally {
            setLoading(false)
        }
    }

    const categories = type === 'pemasukan' ? KATEGORI_PEMASUKAN : KATEGORI_PENGELUARAN

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={transaksiId ? 'Edit Transaksi' : 'Tambah Transaksi'}
            description={transaksiId ? 'Ubah data transaksi' : 'Catat transaksi baru'}
            size="lg"
        >
            <div className="p-6">
                {loadingData ? (
                    <div className="flex items-center justify-center py-8">
                        <HiOutlineBanknotes className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Transaction Type */}
                        {!transaksiId && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Jenis Transaksi
                                </label>
                                <div className="flex gap-4">
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="type"
                                            value="pemasukan"
                                            checked={type === 'pemasukan'}
                                            onChange={() => setType('pemasukan')}
                                            className="mr-2"
                                        />
                                        <span className="text-green-600 font-medium">Pemasukan</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="type"
                                            value="pengeluaran"
                                            checked={type === 'pengeluaran'}
                                            onChange={() => setType('pengeluaran')}
                                            className="mr-2"
                                        />
                                        <span className="text-red-600 font-medium">Pengeluaran</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* Date */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Tanggal <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.tanggal}
                                onChange={(e) => setFormData(prev => ({ ...prev, tanggal: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Jumlah (Rp) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                required
                                min="0"
                                value={formData.jumlah}
                                onChange={(e) => setFormData(prev => ({ ...prev, jumlah: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                placeholder="0"
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Kategori <span className="text-red-500">*</span>
                            </label>
                            <select
                                required
                                value={formData.kategori}
                                onChange={(e) => setFormData(prev => ({ ...prev, kategori: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">Pilih Kategori</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* CAPEX/OPEX for Pengeluaran */}
                        {type === 'pengeluaran' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Tipe Pengeluaran
                                </label>
                                <select
                                    value={formData.tipePengeluaran}
                                    onChange={(e) => setFormData(prev => ({ ...prev, tipePengeluaran: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="OPEX">OPEX (Operational)</option>
                                    <option value="CAPEX">CAPEX (Capital)</option>
                                </select>
                            </div>
                        )}

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Deskripsi
                            </label>
                            <textarea
                                value={formData.deskripsi}
                                onChange={(e) => setFormData(prev => ({ ...prev, deskripsi: e.target.value }))}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                                placeholder="Keterangan transaksi..."
                            />
                        </div>

                        {/* Payment Method */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Metode Pembayaran
                            </label>
                            <select
                                value={formData.metodeBayar}
                                onChange={(e) => setFormData(prev => ({ ...prev, metodeBayar: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                            >
                                {METODE_BAYAR.map(method => (
                                    <option key={method} value={method}>{method}</option>
                                ))}
                            </select>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {loading ? 'Menyimpan...' : 'Simpan'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </Modal>
    )
}
