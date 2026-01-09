'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FiInfo } from 'react-icons/fi'

interface BarangFormProps {
  initialData?: {
    id?: string
    kode?: string
    nama?: string
    satuan?: string
    isWorkOrderMaterial?: boolean
  }
  onSubmit: (data: any) => void
  onCancel: () => void
}

export function BarangForm({ initialData, onSubmit, onCancel }: BarangFormProps) {
  const [formData, setFormData] = useState({
    nama: initialData?.nama || '',
    satuan: initialData?.satuan || '',
    isWorkOrderMaterial: initialData?.isWorkOrderMaterial || false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCustomSatuan, setIsCustomSatuan] = useState(false)
  const router = useRouter()

  const satuanOptions = [
    'pcs', 'meter', 'box', 'roll', 'pack', 'karton', 'liter', 'kg', 'set', 'buah', 'unit'
  ]

  useEffect(() => {
    if (initialData) {
      setFormData({
        nama: initialData.nama || '',
        satuan: initialData.satuan || '',
        isWorkOrderMaterial: initialData.isWorkOrderMaterial || false
      })
      // Check if initial satuan is custom
      if (initialData.satuan && !satuanOptions.includes(initialData.satuan)) {
        setIsCustomSatuan(true)
      }
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.nama.trim() || !formData.satuan.trim()) {
      setError('Nama dan satuan barang harus diisi')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (initialData?.id) {
        // Update existing barang (include kode for updates)
        const updateData = {
          kode: initialData.kode || '',
          nama: formData.nama,
          satuan: formData.satuan,
          isWorkOrderMaterial: formData.isWorkOrderMaterial
        }
        const response = await fetch(`/api/inventory/barang/${initialData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Gagal mengupdate barang')
        }
      } else {
        // Create new barang (kode will be generated automatically)
        const response = await fetch('/api/inventory/barang', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Gagal menambah barang')
        }
      }

      onSubmit(formData)
    } catch (error) {
      console.error('Error submitting barang:', error)
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

      {/* Show kode field only for editing */}
      {initialData?.id && (
        <div>
          <label htmlFor="kode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Kode Barang
          </label>
          <input
            type="text"
            id="kode"
            value={initialData?.kode || ''}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 dark:bg-gray-600 dark:border-gray-600 dark:text-gray-400"
            disabled
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Kode barang tidak dapat diubah
          </p>
        </div>
      )}

      {!initialData?.id && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <FiInfo className="w-4 h-4 shrink-0" /> Kode barang akan di-generate otomatis
          </p>
        </div>
      )}

      <div>
        <label htmlFor="nama" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Nama Barang *
        </label>
        <input
          type="text"
          id="nama"
          value={formData.nama}
          onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Contoh: ONT ZTE F660"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Nama lengkap barang
        </p>
      </div>

      <div>
        <label htmlFor="satuan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Satuan *
        </label>
        <select
          id="satuan"
          value={isCustomSatuan ? 'custom' : formData.satuan}
          onChange={(e) => {
            const val = e.target.value
            if (val === 'custom') {
              setIsCustomSatuan(true)
              setFormData({ ...formData, satuan: '' })
            } else {
              setIsCustomSatuan(false)
              setFormData({ ...formData, satuan: val })
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          disabled={loading}
        >
          <option value="">Pilih satuan</option>
          {satuanOptions.map((satuan) => (
            <option key={satuan} value={satuan}>
              {satuan}
            </option>
          ))}
          <option value="custom">Satuan Kustom (Lainnya)</option>
        </select>
        
        {isCustomSatuan && (
          <div className="mt-2">
            <input
              type="text"
              value={formData.satuan}
              onChange={(e) => setFormData({ ...formData, satuan: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Masukkan nama satuan kustom..."
              disabled={loading}
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Ketik satuan yang tidak tersedia di pilihan (contoh: lusin, lembar)
            </p>
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={formData.isWorkOrderMaterial}
            onChange={(e) => setFormData({ ...formData, isWorkOrderMaterial: e.target.checked })}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            disabled={loading}
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Material Work Order
          </span>
        </label>
        <p className="mt-1 ml-7 text-xs text-gray-500 dark:text-gray-400">
          Centang jika barang ini digunakan teknisi saat mengerjakan Work Order (contoh: kabel, modem, konektor).
        </p>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
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
    </form >
  )
}