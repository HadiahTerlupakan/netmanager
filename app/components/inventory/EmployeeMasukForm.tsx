'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  HiOutlinePlus,
  HiOutlineCheckCircle,
  HiOutlineXMark,
  HiOutlineCamera,
  HiOutlinePhoto,
  HiOutlineCube,
  HiOutlineMagnifyingGlass
} from 'react-icons/hi2'
import { PhotoUpload, type UploadedPhoto } from './PhotoUpload'

export default function EmployeeMasukForm() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    barangId: '',
    gudangId: '',
    jumlah: '',
    purpose: '', // Field keperluan
    kondisi: 'BARU' as 'BARU' | 'BEKAS' | 'RUSAK'
  })
  const [barangs, setBarangs] = useState<any[]>([])
  const [gudangs, setGudangs] = useState<any[]>([])
  const [currentStock, setCurrentStock] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [transactionId] = useState<string>('temp-' + Date.now())

  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Fetch barang dengan stock info
        const barangResponse = await fetch('/api/inventory/barang?limit=100')
        const barangData = await barangResponse.json()
        setBarangs(barangData.barangs || [])

        // Fetch gudang
        const gudangResponse = await fetch('/api/inventory/gudang')
        const gudangData = await gudangResponse.json()
        setGudangs(gudangData.gudangs || [])
      } catch (error) {
        console.error('Error fetching initial data:', error)
        setError('Gagal memuat data awal')
      }
    }

    fetchInitialData()
  }, [])

  useEffect(() => {
    if (formData.barangId && formData.gudangId) {
      // Calculate current stock
      const selectedBarang = barangs.find(b => b.id === formData.barangId)
      if (selectedBarang) {
        const stockInfo = selectedBarang.stockPerGudang?.find((s: any) => s.gudangId === formData.gudangId)
        setCurrentStock(stockInfo?.stok || 0)
      }
    } else {
      setCurrentStock(0)
    }
  }, [formData.barangId, formData.gudangId, barangs])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
    setSuccess('')
  }

  const handleBarangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const barangId = e.target.value
    setFormData(prev => ({
      ...prev,
      barangId,
      // Set satuan based on selected barang if possible
      ...(barangs.find(b => b.id === barangId)?.satuan && { satuan: barangs.find(b => b.id === barangId)?.satuan })
    }))
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

    if (!formData.barangId || !formData.gudangId || !formData.jumlah || !formData.purpose) {
      setError('Semua field wajib harus diisi')
      return
    }

    const jumlah = parseInt(formData.jumlah)
    if (jumlah <= 0) {
      setError('Jumlah harus lebih dari 0')
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
          if (photo.file) { // Ensure file exists before appending
            uploadFormData.append('photos', photo.file);
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
          setError('Gagal mengunggah foto.')
          setLoading(false)
          return
        }
      }

      // Create the inventory transaction with photo URLs
      const response = await fetch('/api/inventory/masuk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barangId: formData.barangId,
          gudangId: formData.gudangId,
          jumlah: jumlah,
          kondisi: formData.kondisi,
          keterangan: formData.purpose,
          fotoBukti: fotoBuktiUrls,
          fotoMetadata: fotoBuktiUrls.length > 0 ? {
            uploadedAt: new Date().toISOString(),
            count: fotoBuktiUrls.length
          } : null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Gagal menambahkan barang masuk')
        setLoading(false)
        return
      }

      setSuccess('Barang berhasil ditambahkan!')
      resetForm()
    } catch (error) {
      console.error('Error adding item:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
      setLoading(false)
    }
  }

  const resetForm = () => {
    setLoading(false)
    setFormData({
      barangId: '',
      gudangId: '',
      jumlah: '',
      purpose: '',
      kondisi: 'BARU'
    })
    setPhotos([])
    setCurrentStock(0)

    // Refresh barang data untuk update stock
    fetch('/api/inventory/barang?limit=100')
      .then(res => res.json())
      .then(data => setBarangs(data.barangs || []))

    // Clear success message after 2 seconds
    setTimeout(() => {
      setSuccess('')
    }, 2000)
  }

  const selectedBarang = barangs.find(b => b.id === formData.barangId)
  const selectedGudang = gudangs.find(g => g.id === formData.gudangId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <HiOutlinePlus className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Barang Masuk</h1>
        </div>
        <p className="text-indigo-100">
          Form input barang baru ke gudang
        </p>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Quick Actions
          </h3>
          <Link
            href="/employee/inventory/inventory-items"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
          >
            <HiOutlineMagnifyingGlass className="w-4 h-4" />
            Cari Barang
          </Link>
        </div>
      </div>

      {/* Form */}
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
              <HiOutlineCheckCircle className="w-5 h-5 text-green-600 dark:text-green-40 flex-shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}

          {/* Barang Selection */}
          <div>
            <label htmlFor="barangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pilih Barang
            </label>
            <select
              id="barangId"
              name="barangId"
              value={formData.barangId}
              onChange={handleBarangChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-colors"
              required
            >
              <option value="">-- Pilih Barang --</option>
              {barangs.map((barang) => (
                <option key={barang.id} value={barang.id}>
                  {barang.kode} - {barang.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Gudang Selection */}
          <div>
            <label htmlFor="gudangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pilih Gudang
            </label>
            <select
              id="gudangId"
              name="gudangId"
              value={formData.gudangId}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-colors"
              required
            >
              <option value="">-- Pilih Gudang --</option>
              {gudangs.map((gudang) => (
                <option key={gudang.id} value={gudang.id}>
                  {gudang.kode} - {gudang.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Kondisi Barang */}
          <div>
            <label htmlFor="kondisi" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Kondisi Barang
            </label>
            <select
              id="kondisi"
              name="kondisi"
              value={formData.kondisi}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-colors"
              required
            >
              <option value="BARU">Baru</option>
              <option value="BEKAS">Bekas</option>
              <option value="RUSAK">Rusak</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Pilih kondisi barang yang dimasukkan
            </p>
          </div>

          {/* Jumlah */}
          <div>
            <label htmlFor="jumlah" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Jumlah
            </label>
            <input
              type="number"
              id="jumlah"
              name="jumlah"
              value={formData.jumlah}
              onChange={handleInputChange}
              min="1"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-colors"
              placeholder="Masukkan jumlah"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Stok saat ini: {currentStock} {selectedBarang?.satuan}
            </p>
          </div>

          {/* Stock Info */}
          {selectedBarang && selectedGudang && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Stok Tersedia
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {selectedBarang.nama} di {selectedGudang.nama}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {currentStock}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {selectedBarang.satuan}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Keperluan - Ditambahkan seperti pada AmbilBarangForm */}
          <div>
            <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Keperluan
            </label>
            <textarea
              id="purpose"
              name="purpose"
              value={formData.purpose}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-colors resize-none"
              placeholder="Contoh: Barang hibah, Barang pembelian baru, Barang dari proyek sebelumnya, dll"
              required
            />
          </div>

          {/* Photo Upload Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HiOutlineCamera className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Foto Barang (Opsional)
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                - Dokumentasi barang masuk
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
                    <li>• Membantu tracking barang</li>
                    <li>• Verifikasi kondisi barang</li>
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
            disabled={loading || !formData.barangId || !formData.gudangId || !formData.jumlah || !formData.purpose}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 text-lg"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <HiOutlinePlus className="w-5 h-5" />
                Input Barang Masuk
              </>
            )}
          </button>
        </form>
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
        <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
          📌 Petunjuk Penggunaan
        </h3>
        <div className="space-y-3">
          <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
            <li>• Pilih barang yang akan dimasukkan dari dropdown</li>
            <li>• Pilih gudang tujuan penyimpanan barang</li>
            <li>• Periksa stok tersedia sebelum input jumlah</li>
            <li>• Jelaskan keperluan pemasukan barang</li>
            <li>• Masukkan jumlah barang yang masuk</li>
          </ul>

          <div className="border-t border-amber-200 dark:border-amber-700 pt-3">
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
    </div>
  )
}