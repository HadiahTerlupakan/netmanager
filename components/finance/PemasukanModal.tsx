"use client"

import { useState, useEffect } from 'react'
import { HiArrowPath } from 'react-icons/hi2'
import Modal from '@/components/common/Modal'

const KATEGORI_OPTIONS = [
  'PENJUALAN',
  'INVESTASI',
  'BONUS',
  'HADIAH',
  'SEWA',
  'LAINNYA',
]

const METODE_BAYAR_OPTIONS = [
  'TRANSFER',
  'CASH',
  'DEBIT',
  'KREDIT',
  'E-WALLET',
]

interface PemasukanModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  pemasukanId?: string | null
  apiEndpoint?: string
  token?: string | null
}

export default function PemasukanModal({
  isOpen,
  onClose,
  onSuccess,
  pemasukanId,
  apiEndpoint = '/api/pemasukan',
  token,
}: PemasukanModalProps) {
  const [loading, setLoading] = useState(false)
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

  const isEdit = !!pemasukanId

  useEffect(() => {
    if (isOpen && isEdit && pemasukanId) {
      loadData()
    } else if (isOpen && !isEdit) {
      // Reset form untuk create
      setFormData({
        tanggal: new Date().toISOString().split('T')[0],
        kategori: '',
        deskripsi: '',
        jumlah: '',
        metodeBayar: '',
        catatan: '',
      })
      setError(null)
    }
  }, [isOpen, isEdit, pemasukanId])

  const loadData = async () => {
    if (!pemasukanId) return
    setFormLoading(true)
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['x-finance-token'] = token
      }

      const response = await fetch(`${apiEndpoint}/${pemasukanId}`, {
        headers,
      })
      if (!response.ok) {
        throw new Error('Gagal memuat data pemasukan')
      }
      const data = await response.json()
      
      const tanggal = new Date(data.tanggal).toISOString().split('T')[0]
      setFormData({
        tanggal,
        kategori: data.kategori || '',
        deskripsi: data.deskripsi || '',
        jumlah: data.jumlah?.toString() || '',
        metodeBayar: data.metodeBayar || '',
        catatan: data.catatan || '',
      })
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data')
    } finally {
      setFormLoading(false)
    }
  }

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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['x-finance-token'] = token
      }

      const url = isEdit ? `${apiEndpoint}/${pemasukanId}` : apiEndpoint
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers,
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
        throw new Error(data.error || `Gagal ${isEdit ? 'mengupdate' : 'menambah'} pemasukan`)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || `Terjadi kesalahan saat ${isEdit ? 'mengupdate' : 'menambah'} pemasukan`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} title={isEdit ? 'Edit Pemasukan' : 'Tambah Pemasukan'}>
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {formLoading ? (
          <div className="flex items-center justify-center py-8">
            <HiArrowPath className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                placeholder="Contoh: Penjualan paket internet bulan Januari"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                rows={3}
                placeholder="Catatan tambahan (opsional)"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="touch-target flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white text-base md:text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <HiArrowPath className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  isEdit ? 'Simpan Perubahan' : 'Simpan'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="touch-target px-4 py-3 text-base md:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Batal
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}




