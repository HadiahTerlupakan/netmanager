'use client'

import { useState, useEffect } from 'react'
import { FiInfo } from 'react-icons/fi'
import { Button } from '@/components/ui/Button'
import { validateBarangForm, sanitizeInput } from '@/lib/validations/barang'
import { useToast } from '@/hooks/use-toast'
import { usePermission } from '@/hooks/use-permission'

interface BarangFormProps {
  initialData?: {
    id?: string
    kode?: string
    nama?: string
    satuan?: string
    isWorkOrderMaterial?: boolean
    jenis?: 'HABIS_PAKAI' | 'ASET'
    kategoriAset?: string
  }
  onSubmit: (data: {
    nama: string
    satuan: string
    isWorkOrderMaterial: boolean
    jenis: 'HABIS_PAKAI' | 'ASET'
    kategoriAset: string | null
  }) => void
  onCancel: () => void
}

const SATUAN_OPTIONS = [
  'pcs', 'meter', 'box', 'roll', 'pack', 'karton', 'liter', 'kg', 'set', 'buah', 'unit'
]

export function BarangForm({ initialData, onSubmit, onCancel }: BarangFormProps) {
  const { hasPermission } = usePermission()
  const canCreate = hasPermission('barang:create')
  const canUpdate = hasPermission('barang:update')
  const isEditing = !!initialData?.id
  const hasAccess = isEditing ? canUpdate : canCreate

  const [formData, setFormData] = useState({
    nama: initialData?.nama || '',
    satuan: initialData?.satuan || '',
    isWorkOrderMaterial: initialData?.isWorkOrderMaterial || false,
    jenis: (initialData?.jenis as 'HABIS_PAKAI' | 'ASET') || 'HABIS_PAKAI',
    kategoriAset: initialData?.kategoriAset || 'ELEKTRONIK'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isCustomSatuan, setIsCustomSatuan] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    if (initialData) {
      setFormData({
        nama: initialData.nama || '',
        satuan: initialData.satuan || '',
        isWorkOrderMaterial: initialData.isWorkOrderMaterial || false,
        jenis: initialData.jenis || 'HABIS_PAKAI',
        kategoriAset: initialData.kategoriAset || 'ELEKTRONIK'
      })
      // Check if initial satuan is custom
      if (initialData.satuan && !SATUAN_OPTIONS.includes(initialData.satuan)) {
        setIsCustomSatuan(true)
      }
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous errors
    setError('')
    setErrors({})

    // Comprehensive validation
    const validation = validateBarangForm({
      nama: formData.nama,
      satuan: formData.satuan,
      jenis: formData.jenis,
      kategoriAset: formData.kategoriAset
    })

    if (!validation.valid) {
      setErrors(validation.errors)
      setError('Mohon perbaiki kesalahan pada form')
      return
    }

    setLoading(true)

    try {
      // Sanitize inputs before sending
      const sanitizedData = {
        nama: sanitizeInput(formData.nama),
        satuan: sanitizeInput(formData.satuan),
        isWorkOrderMaterial: formData.isWorkOrderMaterial,
        jenis: formData.jenis,
        kategoriAset: formData.jenis === 'ASET' ? formData.kategoriAset : null
      }
      if (initialData?.id) {
        // Update existing barang
        const updateData = {
          kode: initialData.kode || '',
          ...sanitizedData
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

        showToast('success', 'Barang berhasil diupdate')
      } else {
        // Create new barang
        const response = await fetch('/api/inventory/barang', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sanitizedData),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Gagal menambah barang')
        }

        showToast('success', 'Barang berhasil ditambahkan')
      }

      onSubmit(sanitizedData)
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
          {Object.keys(errors).length > 0 && (
            <ul className="mt-2 ml-4 list-disc text-sm">
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}>{message}</li>
              ))}
            </ul>
          )}
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

      {/* Jenis Barang Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
             Jenis Barang
           </label>
           <div className="flex gap-4">
             <label className="inline-flex items-center">
               <input
                 type="radio"
                 className="form-radio text-indigo-600"
                 name="jenis"
                 value="HABIS_PAKAI"
                 checked={formData.jenis === 'HABIS_PAKAI'}
                 onChange={(e) => setFormData({ ...formData, jenis: e.target.value as 'HABIS_PAKAI' | 'ASET' })}
               />
               <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Habis Pakai</span>
             </label>
             <label className="inline-flex items-center">
               <input
                 type="radio"
                 className="form-radio text-indigo-600"
                 name="jenis"
                 value="ASET"
                 checked={formData.jenis === 'ASET'}
                 onChange={(_e) => setFormData({ ...formData, jenis: 'ASET', kategoriAset: formData.kategoriAset || 'ELEKTRONIK' })}
               />
               <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Aset Tetap</span>
             </label>
           </div>
           <p className="mt-1 text-xs text-gray-500">
             {formData.jenis === 'ASET'
                ? 'Item akan ditrack per unit (Serial Number) dan memiliki nilai penyusutan'
                : 'Item hanya ditrack jumlah stok (Qty) saja'}
           </p>
        </div>

        {/* Kategori Aset - Only visible if ASET */}
        {formData.jenis === 'ASET' && (
          <div>
            <label htmlFor="kategoriAset" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kategori Aset (untuk Umur Ekonomis)
            </label>
            <select
              id="kategoriAset"
              value={formData.kategoriAset || ''}
              onChange={(e) => setFormData({ ...formData, kategoriAset: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="ELEKTRONIK">Elektronik (4 Tahun)</option>
              <option value="KENDARAAN">Kendaraan (8 Tahun)</option>
              <option value="FURNITURE">Furniture (8 Tahun)</option>
              <option value="BANGUNAN">Bangunan (20 Tahun)</option>
              <option value="LAINNYA">Lainnya</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="nama" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Nama Barang *
        </label>
        <input
          type="text"
          id="nama"
          value={formData.nama}
          onChange={(e) => {
            setFormData({ ...formData, nama: e.target.value })
            // Clear error on change
            if (errors.nama) {
              const newErrors = { ...errors }
              delete newErrors.nama
              setErrors(newErrors)
            }
          }}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
            errors.nama ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="Contoh: ONT ZTE F660"
          disabled={loading || !hasAccess}
          maxLength={200}
        />
        {errors.nama && (
          <p className="mt-1 text-xs text-red-600">{errors.nama}</p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Nama lengkap barang (3-200 karakter)
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
            // Clear error on change
            if (errors.satuan) {
              const newErrors = { ...errors }
              delete newErrors.satuan
              setErrors(newErrors)
            }
          }}
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
            errors.satuan ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading || !hasAccess}
        >
          <option value="">Pilih satuan</option>
          {SATUAN_OPTIONS.map((satuan) => (
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
              onChange={(e) => {
                setFormData({ ...formData, satuan: e.target.value })
                // Clear error on change
                if (errors.satuan) {
                  const newErrors = { ...errors }
                  delete newErrors.satuan
                  setErrors(newErrors)
                }
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.satuan ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Masukkan nama satuan kustom..."
              disabled={loading}
              autoFocus
              maxLength={50}
            />
            {errors.satuan && (
              <p className="mt-1 text-xs text-red-600">{errors.satuan}</p>
            )}
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
            disabled={loading || !hasAccess}
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
            {loading ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}
          </Button>
        )}
      </div>
    </form >
  )
}