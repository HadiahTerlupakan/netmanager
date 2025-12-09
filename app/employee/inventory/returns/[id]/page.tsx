'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  HiOutlineArrowPath,
  HiOutlineCube,
  HiOutlineCalendar,
  HiOutlineBuildingOffice,
  HiOutlineTag,
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineXMark,
  HiOutlineCamera,
  HiOutlinePhoto
} from 'react-icons/hi2'
import { PhotoUpload } from '../../../../components/inventory/PhotoUpload'
import type { UploadedPhoto } from '../../../../components/inventory/PhotoUpload'
import type { EmployeeReturnItem } from '@/types/inventory-returns'

export default function ReturnDetailPage() {
  const params = useParams()
  const router = useRouter()
  const itemId = params.id as string

  const [item, setItem] = useState<EmployeeReturnItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    jumlahDikembalikan: '',
    kondisiPengembalian: 'BAIK' as 'BAIK' | 'RUSAK' | 'HILANG',
    keterangan: ''
  })
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [transactionId, setTransactionId] = useState<string | null>(null)
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [showPhotoSection, setShowPhotoSection] = useState(false)

  useEffect(() => {
    fetchItemDetail()
  }, [itemId])

  const fetchItemDetail = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/inventory/employee/returns?barangId=${itemId}`)
      if (!response.ok) {
        throw new Error('Gagal memuat detail barang')
      }
      
      const data = await response.json()
      const foundItem = data.returns.find((r: EmployeeReturnItem) => r.id === itemId)
      
      if (!foundItem) {
        throw new Error('Barang tidak ditemukan')
      }
      
      setItem(foundItem)
      setFormData(prev => ({
        ...prev,
        jumlahDikembalikan: foundItem.jumlah.toString()
      }))
    } catch (error) {
      console.error('Error fetching item detail:', error)
      setError(error instanceof Error ? error.message : 'Gagal memuat detail barang')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  const handlePhotosChange = (newPhotos: UploadedPhoto[]) => {
    setPhotos(newPhotos)
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!item) return

    if (!formData.jumlahDikembalikan || !formData.kondisiPengembalian) {
      setError('Semua field wajib harus diisi')
      return
    }

    const jumlah = parseInt(formData.jumlahDikembalikan)
    if (jumlah <= 0) {
      setError('Jumlah harus lebih dari 0')
      return
    }

    if (jumlah > item.jumlah) {
      setError(`Jumlah pengembalian melebihi jumlah yang dipinjam. Maksimal: ${item.jumlah}`)
      return
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      // Step 1: Create return transaction
      const response = await fetch('/api/inventory/returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barangKeluarId: item.id,
          jumlahDikembalikan: jumlah,
          kondisiPengembalian: formData.kondisiPengembalian === 'BAIK' ? 'BARU' : 
                              formData.kondisiPengembalian === 'RUSAK' ? 'RUSAK' : 'BEKAS',
          keterangan: formData.keterangan || undefined
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Gagal mengembalikan barang')
        setSubmitting(false)
        return
      }

      const result = await response.json()
      const newTransactionId = result.data?.id || result.returnId || result.id

      if (!newTransactionId) {
        console.error('Response structure:', result)
        setError('Transaksi berhasil dibuat tetapi tidak ada ID yang dikembalikan')
        setSubmitting(false)
        return
      }

      // Step 2: Handle photo uploads if any photos were added
      if (photos.length > 0) {
        setTransactionId(newTransactionId)
        setShowPhotoSection(true)
        setSuccess('Transaksi berhasil! Silakan unggah foto dokumentasi.')
        setSubmitting(false)

        // Auto-upload photos after a short delay
        setTimeout(() => {
          uploadTransactionPhotos(newTransactionId)
        }, 1000)
      } else {
        // No photos to upload - complete process
        setSuccess('Barang berhasil dikembalikan!')
        setTimeout(() => {
          router.push('/employee/inventory?tab=kembali')
        }, 2000)
      }
    } catch (error) {
      console.error('Error returning item:', error)
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setSubmitting(false)
    }
  }

  const uploadTransactionPhotos = async (txId: string) => {
    if (photos.length === 0) return

    setUploadingPhotos(true)
    setError('')

    try {
      const formData = new FormData()

      // Add all photos
      photos.forEach((photo) => {
        formData.append('photos', photo.file)
      })

      formData.append('returnId', txId)

      const response = await fetch('/api/inventory/returns/upload-photo', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        setSuccess(`Barang berhasil dikembalikan dan ${result.data.count} foto berhasil diunggah!`)

        // Update photos status to success
        setPhotos(prev => prev.map(photo => ({
          ...photo,
          status: 'success',
          url: photo.url || result.data.urls[prev.indexOf(photo)] || '',
          progress: 100
        })))

        // Redirect after showing success message
        setTimeout(() => {
          router.push('/employee/inventory?tab=kembali')
        }, 3000)
      } else {
        const errorData = await response.json()
        setError(`Transaksi berhasil tetapi gagal mengunggah foto: ${errorData.error}`)
      }
    } catch (error) {
      console.error('Error uploading photos:', error)
      setError('Transaksi berhasil tetapi terjadi kesalahan saat mengunggah foto')
    } finally {
      setUploadingPhotos(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const getKondisiColor = (kondisi: string) => {
    switch (kondisi) {
      case 'BARU':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
      case 'BEKAS':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
      case 'RUSAK':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !item) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <HiOutlineXMark className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Error
          </h2>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={fetchItemDetail}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Coba Lagi
            </button>
            <Link
              href="/employee/inventory/returns"
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Kembali
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!item) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <Link
            href="/employee/inventory/returns"
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <HiOutlineArrowLeft className="w-5 h-5" />
          </Link>
          <HiOutlineCube className="w-8 h-8" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Detail Barang</h1>
            <p className="text-green-100">
              Form pengembalian barang ke gudang
            </p>
          </div>
        </div>
      </div>

      {/* Item Details */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Informasi Barang
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Nama Barang</label>
              <p className="text-gray-900 dark:text-white font-medium">{item.barang.nama}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Kode Barang</label>
              <p className="text-gray-900 dark:text-white font-medium">{item.barang.kode}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Jumlah Dipinjam</label>
              <p className="text-gray-900 dark:text-white font-medium">{item.jumlah} {item.barang.satuan}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Gudang</label>
              <p className="text-gray-900 dark:text-white font-medium">{item.gudang.nama}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Kondisi Saat Dipinjam</label>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getKondisiColor(item.kondisi)}`}>
                {item.kondisi}
              </span>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Tanggal Pinjam</label>
              <p className="text-gray-900 dark:text-white font-medium">{formatDate(item.tanggal.toString())}</p>
            </div>
          </div>
        </div>

        {item.purpose && (
          <div className="mt-6">
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Keperluan</label>
            <p className="text-gray-900 dark:text-white">{item.purpose}</p>
          </div>
        )}
      </div>

      {/* Return Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Form Pengembalian
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
              <HiOutlineXMark className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
              <HiOutlineCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}

          {/* Jumlah Dikembalikan */}
          <div>
            <label htmlFor="jumlahDikembalikan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Jumlah Dikembalikan
            </label>
            <input
              type="number"
              id="jumlahDikembalikan"
              name="jumlahDikembalikan"
              value={formData.jumlahDikembalikan}
              onChange={handleInputChange}
              min="1"
              max={item.jumlah}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white transition-colors"
              placeholder="Masukkan jumlah yang dikembalikan"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Maksimal: {item.jumlah} {item.barang.satuan}
            </p>
          </div>

          {/* Kondisi Pengembalian */}
          <div>
            <label htmlFor="kondisiPengembalian" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kondisi Barang
            </label>
            <select
              id="kondisiPengembalian"
              name="kondisiPengembalian"
              value={formData.kondisiPengembalian}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white transition-colors"
              required
            >
              <option value="BAIK">Baik</option>
              <option value="RUSAK">Rusak</option>
              <option value="HILANG">Hilang</option>
            </select>
          </div>

          {/* Keterangan */}
          <div>
            <label htmlFor="keterangan" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Keterangan Tambahan
            </label>
            <textarea
              id="keterangan"
              name="keterangan"
              value={formData.keterangan}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white transition-colors resize-none"
              placeholder="Contoh: Barang sedikit tergores, packaging rusak, dll"
            />
          </div>

          {/* Photo Upload Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HiOutlineCamera className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Foto Dokumentasi (Opsional)
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                - Dokumentasi kondisi barang
              </span>
            </div>

            {/* Photo Upload Component */}
            <PhotoUpload
              transactionId={transactionId || undefined}
              transactionType="inventory-masuk"
              onPhotosChange={handlePhotosChange}
              maxPhotos={3}
              maxSizeMB={5}
              disabled={submitting || uploadingPhotos}
              className="mb-4"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || uploadingPhotos || !formData.jumlahDikembalikan}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
          >
            {submitting || uploadingPhotos ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {uploadingPhotos ? 'Mengunggah Foto...' : 'Memproses...'}
              </>
            ) : (
              <>
                <HiOutlineCheckCircle className="w-5 h-5" />
                Kembalikan Barang
              </>
            )}
          </button>

          {/* Photo Upload Progress Section */}
          {showPhotoSection && transactionId && (
            <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  Mengunggah Foto Dokumentasi
                </h3>
              </div>
              <p className="text-xs text-green-700 dark:text-green-300">
                Mohon tunggu sebentar, foto sedang diunggah untuk dokumentasi transaksi #{transactionId.slice(-8)}...
              </p>
              {photos.length > 0 && (
                <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {photos.filter(p => p.status === 'success').length} dari {photos.length} foto berhasil diunggah
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}