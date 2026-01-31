'use client'

import { useState, useCallback, useEffect } from 'react'
import { RestockSettingsForm } from '@/components/inventory/RestockSettingsForm'
import { Modal } from '@/components/ui/Modal'
import { FiTrendingUp, FiTrendingDown, FiMinus, FiAlertTriangle, FiAlertCircle, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'
import { getWithAuth, postWithAuth } from '@/lib/api-client'

interface PredictionData {
  barangId: string
  gudangId: string
  id?: string
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

interface Gudang {
  id: string
  kode: string
  nama: string
}

interface RestockSummary {
  totalItems?: number
  criticalItems?: number
  highPriorityItems?: number
  stockoutRiskItems?: number
}

export default function RestockPage() {
  const { hasPermission } = usePermission()
  const canUpdate = hasPermission('restock:update')

  const [predictions, setPredictions] = useState<PredictionData[]>([])
  const [summary, setSummary] = useState<RestockSummary>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedGudang, setSelectedGudang] = useState('')
  const [gudangs, setGudangs] = useState<Gudang[]>([])
  const [filterUrgency, setFilterUrgency] = useState<string>('')
  const [showSettingsForm, setShowSettingsForm] = useState(false)

  // Reorder State
  const [orderingItem, setOrderingItem] = useState<PredictionData | null>(null)
  const [processingOrder, setProcessingOrder] = useState(false)

  const fetchPredictions = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      let url = '/api/inventory/restock/prediction'
      const params = new URLSearchParams()
      if (selectedGudang) params.append('gudangId', selectedGudang)
      url += `?${params.toString()}`

      const response = await getWithAuth(url)
      const data = await response.json()
      const result = data.data || data

      if (!response.ok || data.success === false) {
        throw new Error(result.error || 'Gagal memuat prediksi')
      }

      let filteredPredictions = result.predictions || []

      // Apply urgency filter
      if (filterUrgency && filterUrgency !== 'ALL') {
        filteredPredictions = filteredPredictions.filter((p: PredictionData) => p.urgency === filterUrgency)
      }

      const mappedPredictions = filteredPredictions.map((p: PredictionData) => ({
        ...p,
        id: `${p.barangId}-${p.gudangId}`
      }))

      setPredictions(mappedPredictions)
      setSummary(result.summary || {})
    } catch (error) {
      console.error('Error fetching predictions:', error)
      setError(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }, [selectedGudang, filterUrgency])

  const fetchGudangs = useCallback(async () => {
    try {
      const response = await fetch('/api/inventory/gudang')
      const data = await response.json()
      if (response.ok && data.success) {
        setGudangs(data.data?.gudangs || data.data || [])
      }
    } catch (error) {
      console.error('Error fetching gudangs:', error)
    }
  }, [])

  useEffect(() => {
    fetchGudangs()
  }, [fetchGudangs])

  useEffect(() => {
    fetchPredictions()
  }, [fetchPredictions])

  const handleReorder = async () => {
    if (!orderingItem) return

    try {
      setProcessingOrder(true)
      const response = await postWithAuth('/api/inventory/procurement/purchase-request', {
        gudangId: orderingItem.gudangId,
        items: [{
          barangId: orderingItem.barangId,
          quantity: orderingItem.recommendedOrderQty
        }],
        keterangan: `Restock Order: ${orderingItem.barangNama}`
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal membuat Purchase Request')
      }

      // Success
      alert(`Purchase Request berhasil dibuat! Nomor: ${data.nomorRequest}`)
      setOrderingItem(null)
      fetchPredictions() // Refresh data
    } catch (error) {
      console.error('Reorder error:', error)
      alert(error instanceof Error ? error.message : 'Gagal memproses order')
    } finally {
      setProcessingOrder(false)
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
      CRITICAL: <FiXCircle className="text-red-600" />,
      HIGH: <FiAlertTriangle className="text-orange-600" />,
      MEDIUM: <FiAlertCircle className="text-yellow-600" />,
      LOW: <FiCheckCircle className="text-green-600" />
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${colors[urgency as keyof typeof colors] || colors.LOW}`}>
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
      case 'INCREASING': return <FiTrendingUp className="text-red-500" />
      case 'DECREASING': return <FiTrendingDown className="text-green-500" />
      default: return <FiMinus className="text-gray-400" />
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

  const columns: Column<PredictionData>[] = [
    {
      key: 'barang',
      header: 'Barang',
      priority: 'primary',
      render: (prediction) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {prediction.barangKode}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {prediction.barangNama}
          </span>
        </div>
      )
    },
    {
      key: 'gudang',
      header: 'Gudang',
      priority: 'secondary',
      render: (prediction) => (
        <div className="flex flex-col">
          <span className="text-sm text-gray-900 dark:text-white">
            {prediction.gudangKode}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {prediction.gudangNama}
          </span>
        </div>
      )
    },
    {
      key: 'stok',
      header: 'Status Stok',
      priority: 'primary',
      render: (prediction) => (
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
      )
    },
    {
      key: 'usage',
      header: 'Penggunaan',
      priority: 'secondary',
      render: (prediction) => (
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
      )
    },
    {
      key: 'prediction',
      header: 'Prediksi',
      priority: 'secondary',
      render: (prediction) => (
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
      )
    },
    {
      key: 'recommendation',
      header: 'Rekomendasi',
      priority: 'primary',
      render: (prediction) => (
        <div className="flex flex-col space-y-2">
          {prediction.recommendedOrderQty > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-2">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-300">
                  Order: {prediction.recommendedOrderQty} {prediction.satuan}
                </div>
              </div>
              {canUpdate && (
                <button
                  onClick={() => setOrderingItem(prediction)}
                  className="inline-flex justify-center items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                   Buat PR
                </button>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Tidak perlu restock
            </div>
          )}
        </div>
      )
    }
  ]

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
            {canUpdate && (
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
            )}
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
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="shrink-0">
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
              <div className="shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <FiXCircle className="text-white w-5 h-5" />
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
              <div className="shrink-0">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <FiAlertTriangle className="text-white w-5 h-5" />
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
              <div className="shrink-0">
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
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Prediksi Kebutuhan Restock
          </h3>
        </div>
        <ResponsiveTable
            data={predictions}
            columns={columns}
            keyField="id"
            loading={loading}
            emptyMessage="Belum ada data prediksi. Atur pengaturan restock untuk barang di gudang terlebih dahulu."
            loadingMessage="Memuat prediksi..."
        />
      </div>

      {/* Settings Form Modal */}
      <Modal
        isOpen={showSettingsForm}
        onClose={() => setShowSettingsForm(false)}
        title="Pengaturan Restock Barang"
        size="3xl"
      >
        <RestockSettingsForm
          onClose={() => setShowSettingsForm(false)}
          onSuccess={() => {
            setShowSettingsForm(false)
            fetchPredictions()
          }}
        />
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!orderingItem}
        onClose={() => !processingOrder && setOrderingItem(null)}
        title="Konfirmasi Restock Order"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Apakah Anda yakin ingin membuat <strong>Purchase Request</strong> untuk items berikut?
          </p>
          
          {orderingItem && (
             <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="font-medium">{orderingItem.barangNama}</div>
                <div className="text-sm text-gray-500">Gudang: {orderingItem.gudangNama}</div>
                <div className="mt-2 text-indigo-600 font-bold">
                    Qty: {orderingItem.recommendedOrderQty} {orderingItem.satuan}
                </div>
             </div>
          )}

          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setOrderingItem(null)}
              disabled={processingOrder}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-50"
            >
              Batal
            </button>
            <button
              onClick={handleReorder}
              disabled={processingOrder}
              className={`px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none flex items-center ${processingOrder ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              {processingOrder && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {processingOrder ? 'Memproses...' : 'Ya, Buat PR'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}