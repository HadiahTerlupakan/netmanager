'use client'

import { useState } from 'react'
import { FiInfo } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { usePermission } from '@/hooks/use-permission'

interface GudangFormData {
  nama: string
  lokasi: string
  isActive: boolean
}

interface GudangFormProps {
  initialData?: {
    id?: string
    kode: string
    nama: string
    lokasi: string | null
    isActive: boolean
  }
  onSubmit: (data: GudangFormData) => void
  onCancel: () => void
}

export function GudangForm({ initialData, onSubmit, onCancel }: GudangFormProps) {
  const { hasPermission } = usePermission()
  const canCreate = hasPermission('gudang:create')
  const canUpdate = hasPermission('gudang:update')
  const isEditing = !!initialData?.id
  const hasAccess = isEditing ? canUpdate : canCreate

  const [formData, setFormData] = useState({
    nama: initialData?.nama || '',
    lokasi: initialData?.lokasi || '',
    isActive: initialData?.isActive ?? true
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nama.trim()) {
      setError('Nama gudang harus diisi')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (initialData?.id) {
        // Include kode for update request (API requires it)
        const updateData = {
          ...formData,
          kode: initialData.kode
        }
        const response = await fetch(`/api/inventory/gudang/${initialData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Gagal mengupdate gudang')
        }
      } else {
        const response = await fetch('/api/inventory/gudang', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

      {!initialData?.id && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200 flex items-center gap-2">
            <FiInfo className="w-4 h-4 shrink-0" /> Kode gudang akan di-generate otomatis
          </p>
        </div>
      )}

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
          disabled={loading || !hasAccess}
        />
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
          disabled={loading || !hasAccess}
        />
      </div>

      <div>
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
            disabled={loading || !hasAccess}
          />
          <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Gudang Aktif
          </label>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline"
          type="button"
          onClick={onCancel}
          
          disabled={loading}
        >
          {hasAccess ? 'Batal' : 'Kembali'}
        </Button>
        {hasAccess && (
          <Button type="submit"
            disabled={loading}
            
          >
            {loading ? 'Menyimpan...' : initialData?.id ? 'Update' : 'Simpan'}
          </Button>
        )}
      </div>
    </form>
  )
}