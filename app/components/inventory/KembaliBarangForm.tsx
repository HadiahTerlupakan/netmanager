'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineXMark,
  HiOutlineCamera,
  HiOutlinePhoto,
  HiOutlineCube
} from 'react-icons/hi2'
import { PhotoUpload } from './PhotoUpload'
import type { UploadedPhoto } from './PhotoUpload'
import type { EmployeeReturnItem } from '@/types/inventory-returns'

export default function KembaliBarangForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    barangKeluarId: '',
    jumlahDikembalikan: '',
    kondisiPengembalian: 'BARU' as 'BARU' | 'BEKAS' | 'RUSAK',
    keterangan: ''
  })
  const [borrowedItems, setBorrowedItems] = useState<EmployeeReturnItem[]>([])
  const [selectedItem, setSelectedItem] = useState<EmployeeReturnItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [transactionId] = useState<string>('temp-' + Date.now())
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchBorrowedItems()
  }, [currentPage, searchTerm])

  const fetchBorrowedItems = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/inventory/employee/returns?${params}`)
      if (!response.ok) {
        throw new Error('Gagal memuat data barang dipinjam')
      }

      const data = await response.json()
      setBorrowedItems(data.returns || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Error fetching borrowed items:', error)
      setError('Gagal memuat data barang dipinjam')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  const handleItemSelect = (itemId: string) => {
    const item = borrowedItems.find(i => i.id === itemId)
    if (item) {
      setSelectedItem(item)
      setFormData(prev => ({
        ...prev,
        barangKeluarId: itemId,
        jumlahDikembalikan: item.jumlah.toString()
      }))
      setError('')
      setSuccess('')
    }
  }

  const handlePhotosChange = (newPhotos: UploadedPhoto[]) => {
    setPhotos(newPhotos)
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.barangKeluarId || !formData.jumlahDikembalikan || !formData.kondisiPengembalian) {
      setError('Semua field wajib harus diisi')
      return
    }

    const jumlah = parseInt(formData.jumlahDikembalikan)
    if (jumlah <= 0) {
      setError('Jumlah harus lebih dari 0')
      return
    }

    if (selectedItem && jumlah > selectedItem.jumlah) {
      setError(`Jumlah pengembalian melebihi jumlah yang dipinjam. Maksimal: ${selectedItem.jumlah}`)
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Upload photos first if any exist
      let fotoBuktiUrls: string[] = []

      if (photos.length > 0) {
        setSuccess('Mengunggah foto...')

        const uploadFormData = new FormData()
        photos.forEach((photo) => {
          if (photo.file) {
            uploadFormData.append('photos', photo.file)
          }
        })
        uploadFormData.append('transactionId', transactionId)
        uploadFormData.append('transactionType', 'inventory-masuk')

        const uploadResponse = await fetch('/api/inventory/upload-photo', {
          method: 'POST',
          body: uploadFormData
        })

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json()
          fotoBuktiUrls = uploadResult.data?.urls || []
        } else {
          console.error('Photo upload failed')
        }
      }

      // Create the return transaction with photo URLs
      const response = await fetch('/api/inventory/returns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barangKeluarId: formData.barangKeluarId,
          jumlahDikembalikan: jumlah,
          kondisiPengembalian: formData.kondisiPengembalian,
          keterangan: formData.keterangan || undefined,
          fotoBukti: fotoBuktiUrls,
          fotoMetadata: fotoBuktiUrls.length > 0 ? {
            uploadedAt: new Date().toISOString(),
            count: fotoBuktiUrls.length
          } : null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Gagal mengembalikan barang')
        setLoading(false)
        return
      }

      setSuccess('Barang berhasil dikembalikan!')
      resetForm()
    } catch (error) {
      console.error('Error returning item:', error)
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setLoading(false)
    }
  }

  const resetForm = () => {
    setLoading(false)
    setFormData({
      barangKeluarId: '',
      jumlahDikembalikan: '',
      kondisiPengembalian: 'BARU',
      keterangan: ''
    })
    setPhotos([])
    setSelectedItem(null)

    // Refresh borrowed items data
    fetchBorrowedItems()

    // Clear success message after 2 seconds
    setTimeout(() => {
      setSuccess('')
    }, 2000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <HiOutlineArrowPath className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Kembali Barang</h1>
        </div>
        <p className="text-green-100">
          Form pengembalian barang ke gudang
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
          📌 Petunjuk Penggunaan
        </h3>
        <div className="space-y-2">
          <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <li>• Pilih barang yang akan dikembalikan dari daftar di atas</li>
            <li>• Pastikan hanya menampilkan barang yang Anda pinjam</li>
            <li>• Masukkan jumlah barang yang dikembalikan</li>
            <li>• Pilih kondisi barang saat dikembalikan</li>
            <li>• Upload foto dokumentasi untuk bukti pengembalian</li>
          </ul>

          <div className="border-t border-amber-200 dark:border-amber-700 pt-2">
            <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-1">
              <HiOutlineCamera className="w-3 h-3" />
              Panduan Foto Dokumentasi:
            </h4>
            <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <li>• Foto opsional tapi direkomendasikan untuk dokumentasi</li>
              <li>• Pastikan foto jelas dan menunjukkan kondisi barang</li>
              <li>• Maksimal 3 foto dengan ukuran 5MB per foto</li>
              <li>• Format: JPEG, PNG, GIF, WebP</li>
              <li>• Foto akan otomatis diunggah setelah transaksi</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Barang Dipinjam List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Barang yang Dipinjam
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Cari barang..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
        </div>

        {borrowedItems.length === 0 ? (
          <div className="text-center py-8">
            <HiOutlineCube className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchTerm ? 'Tidak ada barang yang cocok dengan pencarian' : 'Tidak ada barang yang dipinjam'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {borrowedItems.map((item) => (
              <div
                key={item.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${selectedItem?.id === item.id
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                onClick={() => handleItemSelect(item.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {item.barang.nama}
                      </h3>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                        {item.barang.kode}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Jumlah:</span> {item.jumlah} {item.barang.satuan}
                      </div>
                      <div>
                        <span className="font-medium">Gudang:</span> {item.gudang.nama}
                      </div>
                      <div>
                        <span className="font-medium">Tanggal Pinjam:</span> {formatDate(item.tanggal.toString())}
                      </div>
                      <div>
                        <span className="font-medium">Keperluan:</span> {item.purpose || '-'}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <button
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedItem?.id === item.id
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                    >
                      {selectedItem?.id === item.id ? 'Dipilih' : 'Pilih'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Form Pengembalian */}
      {selectedItem && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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

            {/* Selected Item Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Barang yang Dipilih
              </h3>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p><strong>Nama:</strong> {selectedItem.barang.nama} ({selectedItem.barang.kode})</p>
                <p><strong>Jumlah Dipinjam:</strong> {selectedItem.jumlah} {selectedItem.barang.satuan}</p>
                <p><strong>Gudang:</strong> {selectedItem.gudang.nama}</p>
                <p><strong>Tanggal Pinjam:</strong> {formatDate(selectedItem.tanggal.toString())}</p>
              </div>
            </div>

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
                max={selectedItem.jumlah}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white transition-colors"
                placeholder="Masukkan jumlah yang dikembalikan"
                required
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Maksimal: {selectedItem.jumlah} {selectedItem.barang.satuan}
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
                <option value="BARU">Baru</option>
                <option value="BEKAS">Bekas</option>
                <option value="RUSAK">Rusak</option>
              </select>
            </div>

            {/* Keterangan */}
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
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-gray-700 dark:text-white transition-colors resize-none"
                placeholder="Contoh: Barang hibah, Barang pembelian baru, Barang dari proyek sebelumnya, dll"
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

              {/* Photo Upload Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <HiOutlinePhoto className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Mengapa perlu foto?</p>
                    <ul className="space-y-0.5 ml-4">
                      <li>• Sebagai bukti dokumentasi</li>
                      <li>• Membantu verifikasi kondisi</li>
                      <li>• Meminimalisir disputasi</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Photo Upload Component */}
              <PhotoUpload
                transactionId={transactionId || undefined}
                transactionType="inventory-masuk"
                onPhotosChange={handlePhotosChange}
                maxPhotos={3}
                maxSizeMB={5}
                disabled={loading}
                className="mb-4"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !formData.barangKeluarId || !formData.jumlahDikembalikan}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white font-medium rounded-xl hover:from-green-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 text-lg"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <HiOutlineCheckCircle className="w-5 h-5" />
                  Kembalikan Barang
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
