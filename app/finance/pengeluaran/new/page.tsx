"use client"

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { HiArrowPath, HiBars3, HiOutlineBanknotes, HiArrowLeft } from 'react-icons/hi2'
import Link from 'next/link'
import { useFinance } from '@/hooks/useFinance'

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

export default function FinancePengeluaranNewPage() {
  const router = useRouter()
  const { data: financeUser, loading } = useFinance()
  const [formLoading, setFormLoading] = useState(false)
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
    setFormLoading(true)

    if (!formData.tanggal || !formData.kategori || !formData.deskripsi || !formData.jumlah) {
      setError('Tanggal, kategori, deskripsi, dan jumlah wajib diisi')
      setFormLoading(false)
      return
    }

    try {
      const token = localStorage.getItem('finance_token')
      const response = await fetch('/api/finance/pengeluaran', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-finance-token': token || '',
        },
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

      router.push('/finance/pengeluaran')
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menambah pengeluaran')
    } finally {
      setFormLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <HiArrowPath className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto mb-4" />
          <div className="text-gray-500 dark:text-gray-400">Memuat...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20 md:pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-lg md:ml-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if ((window as any).toggleFinanceSidebar) {
                    ; (window as any).toggleFinanceSidebar()
                  }
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation md:hidden"
                aria-label="Open menu"
              >
                <HiBars3 className="w-6 h-6" />
              </button>
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <HiOutlineBanknotes className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold">Tambah Pengeluaran</h1>
            </div>
            <Link
              href="/finance/pengeluaran"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
              title="Kembali"
            >
              <HiArrowLeft className="w-6 h-6" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4 md:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
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
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-3 pt-4">
              <button
                type="submit"
                disabled={formLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {formLoading ? (
                  <>
                    <HiArrowPath className="w-5 h-5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan'
                )}
              </button>
              <Link
                href="/finance/pengeluaran"
                className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Batal
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

