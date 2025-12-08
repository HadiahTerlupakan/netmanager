'use client'

import { useState, useEffect } from 'react'
import { RestockSettingsForm } from '@/components/inventory/RestockSettingsForm'

interface PredictionData {
  barangId: string
  gudangId: string
  barangKode: string
  barangNama: string
  satuan: string
  gudangKode: string
  gudangNama: string
  currentStok: number
  minStok: number
  maxStok: number
  avgDailyUsage: number
  leadTimeDays: number
  safetyStok: number
  daysUntilStockout: number
  reorderPoint: number
  recommendedOrderQty: number
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  lastRestockDate?: string
  usageTrend: 'INCREASING' | 'DECREASING' | 'STABLE'
  monthlyUsage: number[]
  nextRestockDate: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export default function RestockPage() {
  const [predictions, setPredictions] = useState<PredictionData[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedGudang, setSelectedGudang] = useState('')
  const [gudangs, setGudangs] = useState<any[]>([])
  const [filterUrgency, setFilterUrgency] = useState<string>('')
  const [showSettingsForm, setShowSettingsForm] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    fetchPredictions()
  }, [selectedGudang, filterUrgency])

  const fetchInitialData = async () => {
    try {
      // Fetch gudangs
      const gudangResponse = await fetch('/api/inventory/gudang')
      const gudangData = await gudangResponse.json()
      setGudangs(gudangData.gudangs || [])
    } catch (error) {
      console.error('Error fetching initial data:', error)
    }
  }

  const fetchPredictions = async () => {
    try {
      setLoading(true)
      setError('')

      let url = '/api/inventory/restock/prediction'
      const params = new URLSearchParams()
      if (selectedGudang) params.append('gudangId', selectedGudang)
      url += `?${params.toString()}`

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memuat prediksi')
      }

      let filteredPredictions = data.predictions || []

      // Apply urgency filter
      if (filterUrgency && filterUrgency !== 'ALL') {
        filteredPredictions = filteredPredictions.filter((p: PredictionData) => p.urgency === filterUrgency)
      }

      setPredictions(filteredPredictions)
      setSummary(data.summary || {})
    } catch (error) {
      console.error('Error fetching predictions:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const getUrgencyBadge = (urgency: string) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    }

    const icons = {
      CRITICAL: '🔴',
      HIGH: '🟠',
      MEDIUM: '🟡',
      LOW: '🟢'
    }

    return (
      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${colors[urgency as keyof typeof colors] || colors.LOW}`}>
        {icons[urgency as keyof typeof icons]} {urgency}
      </span>
    )
  }

  const getRiskBadge = (riskLevel: string) => {
    const colors = {
      HIGH: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    }

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${colors[riskLevel as keyof typeof colors] || colors.LOW}`}>
        {riskLevel}
      </span>
    )
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'INCREASING': return '📈'
      case 'DECREASING': return '📉'
      default: return '➡️'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getDaysUntilColor = (days: number) => {
    if (days <= 0) return 'text-red-600 font-bold'
    if (days <= 7) return 'text-orange-600 font-semibold'
    if (days <= 30) return 'text-yellow-600'
    return 'text-green-600'
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Restock Management</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Prediksi dan manajemen kebutuhan restock inventory
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowSettingsForm(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Pengaturan Restock
            </button>
            <button
              onClick={fetchPredictions}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white dark:bg-gray-800 shadow rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter Gudang
            </label>
            <select
              value={selectedGudang}
              onChange={(e) => setSelectedGudang(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Semua Gudang</option>
              {gudangs.map((gudang) => (
                <option key={gudang.id} value={gudang.id}>
                  {gudang.kode} - {gudang.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter Urgency
            </label>
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Semua Level</option>
              <option value="CRITICAL">🔴 Critical</option>
              <option value="HIGH">🟠 High</option>
              <option value="MEDIUM">🟡 Medium</option>
              <option value="LOW">🟢 Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Total Items</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalItems || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">!</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-red-900 dark:text-red-300">Critical</h3>
                <p className="text-2xl font-bold text-red-900 dark:text-red-300">{summary.criticalItems || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">⚠</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-orange-900 dark:text-orange-300">High Priority</h3>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">{summary.highPriorityItems || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">7</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-yellow-900 dark:text-yellow-300">Stockout Risk (7 days)</h3>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-300">{summary.stockoutRiskItems || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
          {error}
          <button
            onClick={fetchPredictions}
            className="ml-2 text-red-600 underline hover:text-red-800"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Predictions Table */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
            Prediksi Kebutuhan Restock
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Memuat prediksi...</span>
            </div>
          ) : predictions.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">Belum ada data prediksi</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Atur pengaturan restock untuk barang di gudang terlebih dahulu
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Barang
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Gudang
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status Stok
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Penggunaan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Prediksi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Rekomendasi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {predictions.map((prediction) => (
                    <tr key={`${prediction.barangId}-${prediction.gudangId}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {prediction.barangKode}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {prediction.barangNama}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-900 dark:text-white">
                            {prediction.gudangKode}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {prediction.gudangNama}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">Stok: {prediction.currentStok} {prediction.satuan}</span>
                            {getUrgencyBadge(prediction.urgency)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Min: {prediction.minStok} | Max: {prediction.maxStok}
                          </div>
                          <div className={`text-xs ${getDaysUntilColor(prediction.daysUntilStockout)}`}>
                            {prediction.daysUntilStockout <= 0 ? 'STOK HABIS' : `${prediction.daysUntilStockout} hari lagi`}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <div className="text-sm">
                            Rata-rata: {prediction.avgDailyUsage.toFixed(1)}/hari
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>Tren:</span>
                            <span>{getTrendIcon(prediction.usageTrend)}</span>
                            <span className="text-xs capitalize">{prediction.usageTrend}</span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Lead time: {prediction.leadTimeDays} hari
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-1">
                          <div className="text-sm">
                            Reorder: {prediction.reorderPoint} {prediction.satuan}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Restock: {formatDate(prediction.nextRestockDate)}
                          </div>
                          <div>
                            {getRiskBadge(prediction.riskLevel)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col space-y-2">
                          {prediction.recommendedOrderQty > 0 ? (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2">
                              <div className="text-sm font-medium text-blue-900 dark:text-blue-300">
                                Order: {prediction.recommendedOrderQty} {prediction.satuan}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Tidak perlu restock
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Settings Form Modal */}
      {showSettingsForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-3xl shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Pengaturan Restock Barang
                </h3>
                <button
                  onClick={() => setShowSettingsForm(false)}
                  className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <RestockSettingsForm
                onClose={() => setShowSettingsForm(false)}
                onSuccess={() => {
                  setShowSettingsForm(false)
                  fetchPredictions()
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}