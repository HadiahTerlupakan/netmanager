'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  HiOutlineCube,
  HiOutlineMagnifyingGlass,
  HiOutlineCheckCircle,
  HiOutlineXMark
} from 'react-icons/hi2'

export default function InventoryPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    barangId: '',
    gudangId: '',
    jumlah: '',
    purpose: '' // Employee-specific field untuk keperluan
  })
  const [barangs, setBarangs] = useState<any[]>([])
  const [gudangs, setGudangs] = useState<any[]>([])
  const [currentStock, setCurrentStock] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Check for URL params (from items page)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const barangId = params.get('barangId')
      if (barangId) {
        setFormData(prev => ({ ...prev, barangId }))
      }
    }
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.barangId || !formData.gudangId || !formData.jumlah || !formData.purpose) {
      setError('Semua field harus diisi')
      return
    }

    const jumlah = parseInt(formData.jumlah)
    if (jumlah <= 0) {
      setError('Jumlah harus lebih dari 0')
      return
    }

    if (jumlah > currentStock) {
      setError(`Stok tidak mencukupi. Stok tersedia: ${currentStock}`)
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/inventory/keluar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barangId: formData.barangId,
          gudangId: formData.gudangId,
          jumlah: jumlah,
          kondisi: 'BARU', // Default condition untuk employee
          purpose: formData.purpose
        }),
      })

      if (response.ok) {
        setSuccess('Barang berhasil diambil!')
        // Reset form
        setFormData({
          barangId: '',
          gudangId: '',
          jumlah: '',
          purpose: ''
        })
        setCurrentStock(0)

        // Refresh data setelah 2 detik
        setTimeout(() => {
          setSuccess('')
          // Refresh barang data untuk update stock
          const barangResponse = fetch('/api/inventory/barang?limit=100')
            .then(res => res.json())
            .then(data => setBarangs(data.barangs || []))
        }, 2000)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Gagal mengambil barang')
      }
    } catch (error) {
      console.error('Error taking item:', error)
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const selectedBarang = barangs.find(b => b.id === formData.barangId)
  const selectedGudang = gudangs.find(g => g.id === formData.gudangId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <HiOutlineCube className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Ambil Barang</h1>
        </div>
        <p className="text-indigo-100">
          Form pengambilan barang untuk keperluan kerja
        </p>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Quick Actions
          </h3>
          <Link
            href="/employee/inventory/items"
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
              <HiOutlineCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
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
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-colors"
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
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-colors"
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
              max={currentStock}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-colors"
              placeholder="Masukkan jumlah"
              required
            />
            {currentStock > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Maksimal: {currentStock} {selectedBarang?.satuan}
              </p>
            )}
          </div>

          {/* Keperluan */}
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
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-colors resize-none"
              placeholder="Contoh: Untuk project X, Ganti alat yang rusak, dll"
              required
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !formData.barangId || !formData.gudangId || !formData.jumlah || !formData.purpose}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <HiOutlineCheckCircle className="w-5 h-5" />
                Ambil Barang
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
        <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
          <li>• Pilih barang yang akan diambil dari dropdown</li>
          <li>• Pilih gudang lokasi barang berada</li>
          <li>• Periksa stok tersedia sebelum input jumlah</li>
          <li>• Jelaskan keperluan pengambilan barang</li>
          <li>• Pastikan jumlah tidak melebihi stok tersedia</li>
        </ul>
      </div>
    </div>
  )
}