"use client"

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { HiArrowPath, HiArrowLeft } from 'react-icons/hi2'
import Link from 'next/link'

const KATEGORI_OPTIONS = [
  'OPERASIONAL',
  'PEMELIHARAAN',
  'GAJI',
  'BONUS',
  'SEWA',
  'LISTRIK',
  'INTERNET',
  'TELEPON',
  'BENSIN',
  'MAINTENANCE',
  'LAINNYA',
]

const METODE_BAYAR_OPTIONS = [
  'TRANSFER',
  'CASH',
  'DEBIT',
  'KREDIT',
  'E-WALLET',
]

export default function PengeluaranNewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    kategori: '',
    deskripsi: '',
    jumlah: '',
    metodeBayar: '',
    catatan: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!formData.tanggal || !formData.kategori || !formData.deskripsi || !formData.jumlah) {
      setError('Tanggal, kategori, deskripsi, dan jumlah wajib diisi')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/pengeluaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: formData.tanggal,
          kategori: formData.kategori,
          deskripsi: formData.deskripsi,
          jumlah: parseInt(formData.jumlah),
          metodeBayar: formData.metodeBayar || null,
          catatan: formData.catatan || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menambah pengeluaran')
      }

      router.push('/admin/finance/pengeluaran')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menambah pengeluaran')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tambah Pengeluaran</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tambah data pengeluaran baru</p>
        </div>
        <Link
          href="/admin/finance/pengeluaran"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <HiArrowLeft className="w-5 h-5" />
          Kembali
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="tanggal" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tanggal <span className="text-red-500">*</span>
              </label>
              <input
                id="tanggal"
                type="date"
                value={formData.tanggal}
                onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                required
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="kategori" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Kategori <span className="text-red-500">*</span>
              </label>
              <select
                id="kategori"
                value={formData.kategori}
                onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                required
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Pilih Kategori</option>
                {KATEGORI_OPTIONS.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="deskripsi" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Deskripsi <span className="text-red-500">*</span>
            </label>
            <input
              id="deskripsi"
              type="text"
              value={formData.deskripsi}
              onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
              required
              placeholder="Contoh: Pembayaran listrik bulan Januari"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="jumlah" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Jumlah (Rp) <span className="text-red-500">*</span>
              </label>
              <input
                id="jumlah"
                type="number"
                value={formData.jumlah}
                onChange={(e) => setFormData({ ...formData, jumlah: e.target.value })}
                required
                min="0"
                placeholder="0"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="metodeBayar" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Metode Pembayaran
              </label>
              <select
                id="metodeBayar"
                value={formData.metodeBayar}
                onChange={(e) => setFormData({ ...formData, metodeBayar: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Pilih Metode</option>
                {METODE_BAYAR_OPTIONS.map((metode) => (
                  <option key={metode} value={metode}>
                    {metode}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="catatan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Catatan
            </label>
            <textarea
              id="catatan"
              value={formData.catatan}
              onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
              rows={4}
              placeholder="Catatan tambahan (opsional)"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <HiArrowPath className="w-5 h-5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </button>
            <Link
              href="/admin/finance/pengeluaran"
              className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Batal
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

