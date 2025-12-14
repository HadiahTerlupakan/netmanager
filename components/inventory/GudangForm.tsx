'use client'

import { useState } from 'react'
import { FiInfo } from 'react-icons/fi'

interface GudangFormProps {
  initialData?: {
    id?: string
    kode: string
    nama: string
    lokasi: string | null
    isActive: boolean
  }
  onSubmit: (data: any) => void
  onCancel: () => void
}

export function GudangForm({ initialData, onSubmit, onCancel }: GudangFormProps) {
  const [formData, setFormData] = useState({
    nama: initialData?.nama || '',
    lokasi: initialData?.lokasi || '',
    isActive: initialData?.isActive ?? true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.nama.trim()) {
      setError('Nama gudang harus diisi')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (initialData?.id) {
        // Update existing gudang
        const response = await fetch(`/api/inventory/gudang/${initialData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Gagal mengupdate gudang')
        }
      } else {
        // Create new gudang
        const response = await fetch('/api/inventory/gudang', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Gagal menambah gudang')
        }
      }

      onSubmit(formData)
    } catch (error) {
      console.error('Error submitting gudang:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {/* Show automatic code info for new gudang */}
      {!initialData?.id && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <FiInfo className="w-4 h-4 flex-shrink-0" /> Kode gudang akan di-generate otomatis
          </p>
        </div>
      )}

      {/* Show kode field for editing existing gudang */}
      {initialData?.id && (
        <div>
          <label htmlFor="kode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Kode Gudang *
          </label>
          <input
            type="text"
            id="kode"
            value={initialData.kode}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:border-gray-600 dark:text-gray-400"
            disabled
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Kode gudang tidak dapat diubah
          </p>
        </div>
      )}

      <div>
        <label htmlFor="nama" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Nama Gudang *
        </label>
        <input
          type="text"
          id="nama"
          value={formData.nama}
          onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Contoh: Gudang Utama"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Nama lengkap lokasi gudang
        </p>
      </div>

      <div>
        <label htmlFor="lokasi" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Lokasi
        </label>
        <input
          type="text"
          id="lokasi"
          value={formData.lokasi}
          onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Contoh: Jl. Sudirman No. 123, Jakarta"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Alamat lengkap gudang (opsional)
        </p>
      </div>

      <div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
            disabled={loading}
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Gudang Aktif
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Centang jika gudang ini dapat digunakan untuk penyimpanan barang
        </p>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Menyimpan...' : initialData?.id ? 'Update' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}