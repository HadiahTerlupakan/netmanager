'use client'

import { useState, useEffect } from 'react'
import { FiActivity } from 'react-icons/fi'

interface RestockSettingsFormProps {
  initialData?: any
  onClose: () => void
  onSuccess: () => void
}

export function RestockSettingsForm({ initialData, onClose, onSuccess }: RestockSettingsFormProps) {
  const [formData, setFormData] = useState({
    barangId: '',
    gudangId: '',
    minStok: '',
    maxStok: '',
    safetyStok: '',
    leadTimeDays: ''
  })
  const [barangs, setBarangs] = useState<any[]>([])
  const [gudangs, setGudangs] = useState<any[]>([])
  const [currentStock, setCurrentStock] = useState(0)
  const [avgDailyUsage, setAvgDailyUsage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

        // If editing, populate form
        if (initialData) {
          setFormData({
            barangId: initialData.barangId || '',
            gudangId: initialData.gudangId || '',
            minStok: initialData.minStok?.toString() || '',
            maxStok: initialData.maxStok?.toString() || '',
            safetyStok: initialData.safetyStok?.toString() || '',
            leadTimeDays: initialData.leadTimeDays?.toString() || ''
          })
          setAvgDailyUsage(initialData.avgDailyUsage || 0)
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
          const selectedBarang = barangs.find(b => b.id === formData.barangId)
          if (selectedBarang) {
            const stockInfo = selectedBarang.stockPerGudang?.find((s: any) => s.gudangId === formData.gudangId)
            setCurrentStock(stockInfo?.stok || 0)

            // Calculate average daily usage (last 30 days)
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

            const usageResponse = await fetch(`/api/inventory/analytics/usage?barangId=${formData.barangId}&gudangId=${formData.gudangId}&days=30`)
            if (usageResponse.ok) {
              const usageData = await usageResponse.json()
              setAvgDailyUsage(usageData.avgDailyUsage || 0)
            }
          }
        } catch (error) {
          console.error('Error fetching stock data:', error)
        }
      } else {
        setCurrentStock(0)
        setAvgDailyUsage(0)
      }
    }

    fetchCurrentStock()
  }, [formData.barangId, formData.gudangId, barangs])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.barangId || !formData.gudangId || !formData.minStok || !formData.maxStok) {
      setError('Barang, gudang, minimal stok, dan maksimal stok harus diisi')
      return
    }

    const minStok = parseInt(formData.minStok)
    const maxStok = parseInt(formData.maxStok)
    const safetyStok = parseInt(formData.safetyStok) || 0
    const leadTimeDays = parseInt(formData.leadTimeDays) || 7

    if (minStok <= 0 || maxStok <= 0) {
      setError('Stok harus bernilai positif')
      return
    }

    if (minStok >= maxStok) {
      setError('Minimal stok harus lebih kecil dari maksimal stok')
      return
    }

    if (safetyStok < 0) {
      setError('Safety stok tidak boleh negatif')
      return
    }

    if (leadTimeDays < 1) {
      setError('Lead time minimal 1 hari')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/inventory/restock/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barangId: formData.barangId,
          gudangId: formData.gudangId,
          minStok,
          maxStok,
          safetyStok,
          leadTimeDays
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan pengaturan restock')
      }

      setSuccess('Pengaturan restock berhasil disimpan!')

      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)

    } catch (error) {
      console.error('Error saving restock settings:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const selectedBarang = barangs.find(b => b.id === formData.barangId)
  const selectedGudang = gudangs.find(g => g.id === formData.gudangId)

  // Calculate recommendations
  const minStok = parseInt(formData.minStok) || 0
  const maxStok = parseInt(formData.maxStok) || 0
  const safetyStok = parseInt(formData.safetyStok) || 0
  const leadTimeDays = parseInt(formData.leadTimeDays) || 7

  const reorderPoint = minStok + safetyStok + (avgDailyUsage * leadTimeDays)
  const daysUntilStockout = avgDailyUsage > 0 ? Math.floor(currentStock / avgDailyUsage) : 999
  const recommendedOrder = Math.max(0, maxStok - currentStock)

  const getRecommendationColor = () => {
    if (currentStock === 0) return 'text-red-600 font-bold'
    if (currentStock <= minStok) return 'text-orange-600 font-semibold'
    if (currentStock <= reorderPoint) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
            value={formData.barangId}
            onChange={(e) => setFormData({ ...formData, barangId: e.target.value })}
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
        </div>

        <div>
          <label htmlFor="gudangId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gudang *
          </label>
          <select
            id="gudangId"
            value={formData.gudangId}
            onChange={(e) => setFormData({ ...formData, gudangId: e.target.value })}
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
        </div>
      </div>

      {/* Current Status */}
      {selectedBarang && selectedGudang && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Status Saat Ini</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Barang & Gudang</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {selectedBarang.kode} di {selectedGudang.kode}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Stok Saat Ini</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {currentStock} {selectedBarang.satuan}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pemakaian Rata-rata</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {avgDailyUsage.toFixed(1)} {selectedBarang.satuan}/hari
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Restock Parameters */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Parameter Restock</h3>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="minStok" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stok Minimum (Reorder Point)
            </label>
            <input
              type="number"
              id="minStok"
              value={formData.minStok}
              onChange={(e) => setFormData({ ...formData, minStok: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="10"
              min="1"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Stok minimum sebelum perlu order
            </p>
          </div>

          <div>
            <label htmlFor="maxStok" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stok Maksimum
            </label>
            <input
              type="number"
              id="maxStok"
              value={formData.maxStok}
              onChange={(e) => setFormData({ ...formData, maxStok: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="100"
              min="1"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Stok maksimal yang ingin dipertahankan
            </p>
          </div>

          <div>
            <label htmlFor="safetyStok" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Safety Stock (Buffer)
            </label>
            <input
              type="number"
              id="safetyStok"
              value={formData.safetyStok}
              onChange={(e) => setFormData({ ...formData, safetyStok: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="5"
              min="0"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Buffer stok untuk antisipasi delay
            </p>
          </div>

          <div>
            <label htmlFor="leadTimeDays" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Lead Time (hari)
            </label>
            <input
              type="number"
              id="leadTimeDays"
              value={formData.leadTimeDays}
              onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="7"
              min="1"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Estimasi waktu supplier mengirim barang
            </p>
          </div>
        </div>
      </div>

      {/* Prediction Preview */}
      {minStok > 0 && maxStok > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
            <FiActivity className="w-4 h-4" /> Prediksi Berdasarkan Parameter
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Reorder Point:</span>
              <span className="font-medium text-blue-900 dark:text-blue-300">
                {reorderPoint.toFixed(1)} {selectedBarang?.satuan}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Stok Habis Dalam:</span>
              <span className={`font-medium ${getRecommendationColor()}`}>
                {daysUntilStockout === 999 ? 'N/A' : `${daysUntilStockout} hari`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Rekomendasi Order:</span>
              <span className="font-medium text-blue-900 dark:text-blue-300">
                {recommendedOrder} {selectedBarang?.satuan}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Status Saat Ini:</span>
              <span className={`font-medium ${getRecommendationColor()}`}>
                {currentStock === 0 ? 'STOK HABIS - Segera order!' :
                  currentStock <= minStok ? 'STOK RENDAH - Perlu order' :
                    currentStock <= reorderPoint ? 'STOK WASPADA - Pertimbangkan order' :
                      'STOK AMAN'}
              </span>
            </div>
          </div>
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
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </form>
  )
}