'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { PhotoUpload } from './PhotoUpload'
import type { PhotoUploadRef } from './PhotoUpload'

interface MasukFormProps {
  initialData?: any
  onClose: () => void
}

export function MasukForm({ initialData, onClose }: MasukFormProps) {
  const [formData, setFormData] = useState({
    barangId: '',
    gudangId: '',
    jumlah: '',
    kondisi: 'BARU' as 'BARU' | 'BEKAS' | 'RUSAK',
    keterangan: '',
    tanggal: new Date().toISOString().split('T')[0]
  })
  const [barangs, setBarangs] = useState<any[]>([])
  const [gudangs, setGudangs] = useState<any[]>([])
  const [currentStock, setCurrentStock] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [uploadedPhotos, setUploadedPhotos] = useState<any[]>([])
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const photoUploadRef = useRef<PhotoUploadRef>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Fetch barang
        const barangResponse = await fetch('/api/inventory/barang?limit=100')
        const barangData = await barangResponse.json()
        setBarangs(barangData.barangs || [])

        // Fetch gudang
        const gudangResponse = await fetch('/api/inventory/gudang')
        const gudangData = await gudangResponse.json()
        setGudangs(gudangData.gudangs || [])

        // If in edit mode, populate form with initial data
        if (initialData) {
          setFormData({
            barangId: initialData.barangId || '',
            gudangId: initialData.gudangId || '',
            jumlah: initialData.jumlah?.toString() || '',
            kondisi: initialData.kondisi || 'BARU',
            keterangan: initialData.keterangan || '',
            tanggal: initialData.tanggal ? new Date(initialData.tanggal).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          })
          setTransactionId(initialData.id || null)
        }
      } catch (error) {
        console.error('Error fetching initial data:', error)
        setError('Gagal memuat data awal')
      }
    }

    fetchInitialData()
  }, [initialData])

  useEffect(() => {
    async function fetchCurrentStock() {
      if (formData.barangId && formData.gudangId) {
        try {
          // Check current stock for this barang-gudang combination
          const selectedBarang = barangs.find(b => b.id === formData.barangId)
          if (selectedBarang) {
            const stockInfo = selectedBarang.stockPerGudang?.find((s: any) => s.gudangId === formData.gudangId)
            setCurrentStock(stockInfo?.stok || 0)
          }
        } catch (error) {
          console.error('Error fetching current stock:', error)
        }
      } else {
        setCurrentStock(0)
      }
    }

    fetchCurrentStock()
  }, [formData.barangId, formData.gudangId, barangs])

  // Effect to handle photo upload completion
  useEffect(() => {
    // Check if all photos have been uploaded successfully
    if (transactionId && uploadedPhotos.length > 0) {
      const allUploaded = uploadedPhotos.every(photo => photo.status === 'success')
      const hasError = uploadedPhotos.some(photo => photo.status === 'error')

      if (allUploaded) {
        setSuccess('Barang masuk berhasil dicatat! Foto berhasil diunggah.')

        // Reset form after a short delay
        setTimeout(() => {
          setFormData({
            barangId: '',
            gudangId: '',
            jumlah: '',
            kondisi: 'BARU',
            keterangan: '',
            tanggal: new Date().toISOString().split('T')[0]
          })
          setCurrentStock(0)
          setUploadedPhotos([])
          setTransactionId(null)
          onClose()
        }, 2000)
      } else if (hasError) {
        setSuccess('Barang masuk berhasil dicatat, namun beberapa foto gagal diunggah.')
      }
    }
  }, [uploadedPhotos, transactionId, onClose])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    console.log('handleInputChange called:', { name, value, type: e.target.type })
    setFormData(prev => {
      const newData = { ...prev, [name]: value }
      console.log('Updated formData:', newData)
      return newData
    })
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation - only validate in create mode
    if (!initialData) {
      if (!formData.barangId || !formData.gudangId || !formData.jumlah) {
        setError('Barang, gudang, dan jumlah harus diisi')
        return
      }

      const jumlah = parseInt(formData.jumlah)
      if (isNaN(jumlah) || jumlah <= 0) {
        setError('Jumlah harus berupa angka positif')
        return
      }
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (initialData) {
        // Edit mode - we already have a transaction ID
        if (uploadedPhotos.length > 0) {
          setSuccess('Mengunggah foto...')
          // The PhotoUpload component will handle the upload automatically
          // when transactionId is already set
        } else {
          setSuccess('Tidak ada foto baru untuk diunggah')
          setTimeout(() => {
            onClose()
          }, 1000)
        }
      } else {
        // Create mode - upload photos first, then create transaction
        const jumlah = parseInt(formData.jumlah)
        console.log('FORM DATA before submit:', formData)
        console.log('PARSED jumlah:', jumlah)

        // Upload photos first if any exist
        let fotoBuktiUrls: string[] = []
        let uploadedPhotosList: any[] = []

        if (photoUploadRef.current) {
          const currentPhotos = photoUploadRef.current.getPhotos()

          if (currentPhotos.length > 0) {
            setSuccess('Mengunggah foto...')

            // Upload photos
            fotoBuktiUrls = await photoUploadRef.current.uploadPhotos()

            // Get updated photos after upload
            uploadedPhotosList = photoUploadRef.current.getPhotos()

            // Check if any photos failed to upload
            const failedPhotos = uploadedPhotosList.filter(photo => photo.status === 'error')
            if (failedPhotos.length > 0) {
              throw new Error(`Beberapa foto gagal diunggah: ${failedPhotos.map(p => p.error).join(', ')}`)
            }
          }
        }

        const response = await fetch('/api/inventory/masuk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barangId: String(formData.barangId),
            gudangId: String(formData.gudangId),
            jumlah: Number(jumlah),
            kondisi: String(formData.kondisi),
            keterangan: String(formData.keterangan || ''),
            tanggal: String(formData.tanggal),
            fotoBukti: fotoBuktiUrls,
            fotoMetadata: uploadedPhotosList.length > 0 ? {
              uploadedAt: new Date().toISOString(),
              count: uploadedPhotosList.length,
              totalSize: uploadedPhotosList.reduce((sum, photo) => sum + (photo.file?.size || 0), 0)
            } : null
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Gagal mencatat barang masuk')
        }

        // Extract transaction ID from response
        if (data.masukId) {
          setTransactionId(data.masukId)
          setSuccess('Barang masuk berhasil dicatat!')

          // Reset form after a short delay
          setTimeout(() => {
            setFormData({
              barangId: '',
              gudangId: '',
              jumlah: '',
              kondisi: 'BARU',
              keterangan: '',
              tanggal: new Date().toISOString().split('T')[0]
            })
            setCurrentStock(0)
            setUploadedPhotos([])
            setTransactionId(null)
            // Reset photo upload component
            if (photoUploadRef.current) {
              photoUploadRef.current.resetPhotos()
            }
            onClose()
          }, 1500)
        } else {
          setSuccess('Barang masuk berhasil dicatat!')

          // Reset form
          setTimeout(() => {
            setFormData({
              barangId: '',
              gudangId: '',
              jumlah: '',
              kondisi: 'BARU',
              keterangan: '',
              tanggal: new Date().toISOString().split('T')[0]
            })
            setCurrentStock(0)
            setUploadedPhotos([])
            onClose()
          }, 1000)
        }
      }

    } catch (error) {
      console.error('Error submitting barang masuk:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const selectedBarang = barangs.find(b => b.id === formData.barangId)
  const selectedGudang = gudangs.find(g => g.id === formData.gudangId)

  const getStockStatusColor = (stock: number) => {
    if (stock === 0) return 'text-red-600 font-bold'
    if (stock < 5) return 'text-yellow-600 font-semibold'
    return 'text-green-600'
  }

  const getKondisiColor = (kondisi: string) => {
    switch (kondisi) {
      case 'BARU': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'BEKAS': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'RUSAK': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {initialData ? 'Edit Barang Masuk' : 'Catat Barang Masuk'}
        </h2>
        {initialData && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Tambahkan foto untuk dokumentasi transaksi yang sudah ada
          </p>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="barangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Barang *
          </label>
          <select
            id="barangId"
            name="barangId"
            value={formData.barangId}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading || !!initialData}
          >
            <option value="">Pilih barang</option>
            {barangs.map((barang) => (
              <option key={barang.id} value={barang.id}>
                {barang.kode} - {barang.nama}
              </option>
            ))}
          </select>
          {initialData && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Barang tidak dapat diubah pada mode edit
            </p>
          )}
        </div>

        <div>
          <label htmlFor="gudangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gudang *
          </label>
          <select
            id="gudangId"
            name="gudangId"
            value={formData.gudangId}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading || !!initialData}
          >
            <option value="">Pilih gudang</option>
            {gudangs.map((gudang) => (
              <option key={gudang.id} value={gudang.id}>
                {gudang.kode} - {gudang.nama}
              </option>
            ))}
          </select>
          {initialData && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Gudang tidak dapat diubah pada mode edit
            </p>
          )}
        </div>
      </div>

      {/* Selected Barang & Gudang Info */}
      {(selectedBarang || selectedGudang) && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {selectedBarang && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Barang terpilih:</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedBarang.kode} - {selectedBarang.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Satuan: {selectedBarang.satuan}
                </p>
              </div>
            )}
            {selectedGudang && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gudang terpilih:</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedGudang.kode} - {selectedGudang.nama}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Lokasi: {selectedGudang.lokasi || '-'}
                </p>
              </div>
            )}
            {currentStock >= 0 && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Stok saat ini:</p>
                <p className={`text-lg ${getStockStatusColor(currentStock)}`}>
                  {currentStock} {selectedBarang?.satuan || 'pcs'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {currentStock === 0 && 'Stok kosong'}
                  {currentStock > 0 && currentStock < 5 && 'Stok menipis'}
                  {currentStock >= 5 && 'Stok aman'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="jumlah" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Jumlah *
          </label>
          <div className="relative">
            <input
              type="number"
              id="jumlah"
              name="jumlah"
              value={formData.jumlah}
              onChange={handleInputChange}
              className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="0"
              min="1"
              disabled={loading || !!initialData}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
              {selectedBarang?.satuan || 'pcs'}
            </span>
          </div>
          {initialData && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Jumlah tidak dapat diubah pada mode edit
            </p>
          )}
        </div>

        <div>
          <label htmlFor="kondisi" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Kondisi Barang *
          </label>
          <select
            id="kondisi"
            name="kondisi"
            value={formData.kondisi}
            onChange={(e) => {
              const { value } = e.target
              setFormData(prev => ({ ...prev, kondisi: value as 'BARU' | 'BEKAS' | 'RUSAK' }))
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading || !!initialData}
          >
            <option value="BARU">🟢 Baru</option>
            <option value="BEKAS">🟡 Bekas</option>
            <option value="RUSAK">🔴 Rusak</option>
          </select>
          <div className="mt-1">
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getKondisiColor(formData.kondisi)}`}>
              {formData.kondisi === 'BARU' && 'Baru - Siap pakai'}
              {formData.kondisi === 'BEKAS' && 'Bekas - Pernah dipakai'}
              {formData.kondisi === 'RUSAK' && 'Rusak - Perlu perbaikan'}
            </span>
          </div>
          {initialData && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Kondisi tidak dapat diubah pada mode edit
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="tanggal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tanggal
        </label>
        <input
          type="date"
          id="tanggal"
          name="tanggal"
          value={formData.tanggal}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          disabled={loading || !!initialData}
        />
        {initialData && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Tanggal tidak dapat diubah pada mode edit
          </p>
        )}
      </div>

      <div>
        <label htmlFor="keterangan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Keterangan
        </label>
        <textarea
          id="keterangan"
          name="keterangan"
          value={formData.keterangan}
          onChange={handleInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Contoh: Dari supplier PT Telkom Indonesia"
          disabled={loading || !!initialData}
        />
        {initialData && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Keterangan tidak dapat diubah pada mode edit
          </p>
        )}
      </div>

      {/* Photo Upload Section */}
      {(!initialData || transactionId) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Foto Barang (Opsional)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {initialData
              ? 'Tambah foto barang untuk dokumentasi (maksimal 5 foto)'
              : 'Upload foto barang saat masuk untuk dokumentasi (maksimal 5 foto)'
            }
          </p>
          {initialData && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>Mode Edit:</strong> Anda dapat menambahkan foto baru untuk transaksi ini.
              </p>
            </div>
          )}
          <PhotoUpload
            ref={photoUploadRef}
            transactionId={transactionId || 'temp-' + Date.now()}
            transactionType="inventory-masuk"
            onPhotosChange={setUploadedPhotos}
            maxPhotos={5}
            maxSizeMB={5}
            disabled={loading}
            className="border border-gray-200 dark:border-gray-600 rounded-lg"
          />
        </div>
      )}
      {initialData && !transactionId && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>Perhatian:</strong> Data transaksi sedang dimuat. Foto dapat ditambahkan setelah data tersedia.
          </p>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          disabled={loading}
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Menyimpan...'
            : initialData
              ? 'Update & Upload Foto'
              : 'Simpan'
          }
        </button>
      </div>
    </form>
  )
}