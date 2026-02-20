"use client"

import { useEffect, useState, useCallback } from 'react'
import { HiPencil, HiTrash, HiExclamationCircle } from 'react-icons/hi2'
import Modal from '@/components/common/Modal'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import { SiteFilter } from '@/components/common/SiteFilter'

type Bandwidth = {
  id: string
  name: string
  maxLimitDownload: string
  maxLimitUpload: string
  burstLimitDownload?: string | null
  burstLimitUpload?: string | null
  minLimitDownload?: string | null
  minLimitUpload?: string | null
  burstThresholdDownload?: string | null
  burstThresholdUpload?: string | null
  burstTimeDownload?: number | null
  burstTimeUpload?: number | null
  priority?: number | null
  uploadSpeed?: number | null // Legacy
  downloadSpeed?: number | null // Legacy
  description?: string | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  createdAt: string
  siteId?: string | null
  _count?: {
    hargaPakets: number
  }
}

export default function BandwidthPage() {
  const [loading, setLoading] = useState(true)
  const [bandwidths, setBandwidths] = useState<Bandwidth[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBandwidth, setEditingBandwidth] = useState<Bandwidth | null>(null)
  const [siteId, setSiteId] = useState<string | undefined>(undefined)
  const [formData, setFormData] = useState({
    name: '',
    // Max Limit (wajib) - dengan unit terpisah
    maxLimitDownloadValue: '',
    maxLimitDownloadUnit: 'M' as 'k' | 'M' | 'G' | 'T',
    maxLimitUploadValue: '',
    maxLimitUploadUnit: 'M' as 'k' | 'M' | 'G' | 'T',
    // Burst Limit (opsional)
    burstLimitDownloadValue: '',
    burstLimitDownloadUnit: 'M' as 'k' | 'M' | 'G' | 'T',
    burstLimitUploadValue: '',
    burstLimitUploadUnit: 'M' as 'k' | 'M' | 'G' | 'T',
    // Min Limit (opsional)
    minLimitDownloadValue: '',
    minLimitDownloadUnit: 'M' as 'k' | 'M' | 'G' | 'T',
    minLimitUploadValue: '',
    minLimitUploadUnit: 'M' as 'k' | 'M' | 'G' | 'T',
    // Burst Threshold (opsional)
    burstThresholdDownloadValue: '',
    burstThresholdDownloadUnit: 'M' as 'k' | 'M' | 'G' | 'T',
    burstThresholdUploadValue: '',
    burstThresholdUploadUnit: 'M' as 'k' | 'M' | 'G' | 'T',
    // Burst Time (opsional)
    burstTimeDownload: undefined as number | undefined,
    burstTimeUpload: undefined as number | undefined,
    // Priority (opsional)
    priority: undefined as number | undefined,
    description: '',
    status: 'AKTIF' as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE',
    siteId: '',
  })

  // Helper function untuk parse format MikroTik (contoh: "10M" -> {value: "10", unit: "M"})
  const parseMikrotikFormat = (format: string): { value: string; unit: 'k' | 'M' | 'G' | 'T' } => {
    if (!format) return { value: '', unit: 'M' }
    const match = format.match(/^(\d+(?:\.\d+)?)([kMGT])?$/)
    if (match) {
      return {
        value: match[1] || '',
        unit: (match[2] || 'M') as 'k' | 'M' | 'G' | 'T',
      }
    }
    return { value: format, unit: 'M' }
  }

  // Helper function untuk format ke MikroTik (contoh: {value: "10", unit: "M"} -> "10M")
  const formatToMikrotik = (value: string, unit: string): string => {
    if (!value) return ''
    return `${value}${unit}`
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (siteId) params.append('siteId', siteId)

      const res = await fetch(`/api/bandwidths?${params.toString()}`)

      if (!res.ok) {
        let errorMessage = `Gagal memuat data bandwidth: ${res.status}`
        try {
          const errorData = await res.json()
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            errorMessage = errorData.error || errorMessage
          }
        } catch (_e) {
          errorMessage = `Gagal memuat data bandwidth: ${res.status} ${res.statusText || ''}`
        }
        throw new Error(errorMessage)
      }

      const json = await res.json()
      const dataArray = Array.isArray(json) ? json : (json.data || [])
      setBandwidths(dataArray)
      setError(null)
    } catch (error: unknown) {
      console.error('Error loading data:', error)
      const errorMsg = error instanceof Error ? error.message : 'Gagal memuat data'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const url = editingBandwidth
        ? `/api/bandwidths/${editingBandwidth.id}`
        : '/api/bandwidths'
      const method = editingBandwidth ? 'PUT' : 'POST'

      // Clean data: convert value + unit to MikroTik format
      const dataToSend = {
        name: formData.name,
        maxLimitDownload: formatToMikrotik(formData.maxLimitDownloadValue, formData.maxLimitDownloadUnit),
        maxLimitUpload: formatToMikrotik(formData.maxLimitUploadValue, formData.maxLimitUploadUnit),
        burstLimitDownload: formData.burstLimitDownloadValue ? formatToMikrotik(formData.burstLimitDownloadValue, formData.burstLimitDownloadUnit) : undefined,
        burstLimitUpload: formData.burstLimitUploadValue ? formatToMikrotik(formData.burstLimitUploadValue, formData.burstLimitUploadUnit) : undefined,
        minLimitDownload: formData.minLimitDownloadValue ? formatToMikrotik(formData.minLimitDownloadValue, formData.minLimitDownloadUnit) : undefined,
        minLimitUpload: formData.minLimitUploadValue ? formatToMikrotik(formData.minLimitUploadValue, formData.minLimitUploadUnit) : undefined,
        burstThresholdDownload: formData.burstThresholdDownloadValue ? formatToMikrotik(formData.burstThresholdDownloadValue, formData.burstThresholdDownloadUnit) : undefined,
        burstThresholdUpload: formData.burstThresholdUploadValue ? formatToMikrotik(formData.burstThresholdUploadValue, formData.burstThresholdUploadUnit) : undefined,
        burstTimeDownload: formData.burstTimeDownload || undefined,
        burstTimeUpload: formData.burstTimeUpload || undefined,
        priority: formData.priority || undefined,
        description: formData.description?.trim() || undefined,
        status: formData.status,
        siteId: formData.siteId || undefined,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal menyimpan bandwidth')
      }

      await loadData()
      handleCloseModal()
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Terjadi kesalahan'
      alert(errorMsg)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus bandwidth ini?')) {
      return
    }

    try {
      const res = await fetch(`/api/bandwidths/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal menghapus bandwidth')
        return
      }

      await loadData()
    } catch (error) {
      console.error('Error deleting bandwidth:', error)
      alert('Terjadi kesalahan saat menghapus bandwidth')
    }
  }

  const handleEdit = (bandwidth: Bandwidth) => {
    setEditingBandwidth(bandwidth)

    // Parse format MikroTik menjadi value dan unit
    const maxLimitD = parseMikrotikFormat(bandwidth.maxLimitDownload || '')
    const maxLimitU = parseMikrotikFormat(bandwidth.maxLimitUpload || '')
    const burstLimitD = parseMikrotikFormat(bandwidth.burstLimitDownload || '')
    const burstLimitU = parseMikrotikFormat(bandwidth.burstLimitUpload || '')
    const minLimitD = parseMikrotikFormat(bandwidth.minLimitDownload || '')
    const minLimitU = parseMikrotikFormat(bandwidth.minLimitUpload || '')
    const burstThresholdD = parseMikrotikFormat(bandwidth.burstThresholdDownload || '')
    const burstThresholdU = parseMikrotikFormat(bandwidth.burstThresholdUpload || '')

    setFormData({
      name: bandwidth.name,
      maxLimitDownloadValue: maxLimitD.value,
      maxLimitDownloadUnit: maxLimitD.unit,
      maxLimitUploadValue: maxLimitU.value,
      maxLimitUploadUnit: maxLimitU.unit,
      burstLimitDownloadValue: burstLimitD.value,
      burstLimitDownloadUnit: burstLimitD.unit,
      burstLimitUploadValue: burstLimitU.value,
      burstLimitUploadUnit: burstLimitU.unit,
      minLimitDownloadValue: minLimitD.value,
      minLimitDownloadUnit: minLimitD.unit,
      minLimitUploadValue: minLimitU.value,
      minLimitUploadUnit: minLimitU.unit,
      burstThresholdDownloadValue: burstThresholdD.value,
      burstThresholdDownloadUnit: burstThresholdD.unit,
      burstThresholdUploadValue: burstThresholdU.value,
      burstThresholdUploadUnit: burstThresholdU.unit,
      burstTimeDownload: bandwidth.burstTimeDownload || undefined,
      burstTimeUpload: bandwidth.burstTimeUpload || undefined,
      priority: bandwidth.priority || undefined,
      description: bandwidth.description || '',
      status: bandwidth.status,
      siteId: bandwidth.siteId || '',
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingBandwidth(null)
    setFormData({
      name: '',
      maxLimitDownloadValue: '',
      maxLimitDownloadUnit: 'M',
      maxLimitUploadValue: '',
      maxLimitUploadUnit: 'M',
      burstLimitDownloadValue: '',
      burstLimitDownloadUnit: 'M',
      burstLimitUploadValue: '',
      burstLimitUploadUnit: 'M',
      minLimitDownloadValue: '',
      minLimitDownloadUnit: 'M',
      minLimitUploadValue: '',
      minLimitUploadUnit: 'M',
      burstThresholdDownloadValue: '',
      burstThresholdDownloadUnit: 'M',
      burstThresholdUploadValue: '',
      burstThresholdUploadUnit: 'M',
      burstTimeDownload: undefined,
      burstTimeUpload: undefined,
      priority: undefined,
      description: '',
      status: 'AKTIF',
      siteId: '',
    })
  }

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span>
        <span>Paket</span> <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white">Bandwidth</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bandwidth</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola profil bandwidth untuk paket internet
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="w-full md:w-48">
                <SiteFilter 
                  value={siteId || ''}
                  onSiteChange={setSiteId} 
                />
             </div>
            <button
              onClick={() => {
                setFormData(prev => ({ ...prev, siteId: siteId || '' }))
                setIsModalOpen(true)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <span>+</span>
              Tambah Bandwidth
            </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Card */}
      <ResponsiveTable
        data={bandwidths}
        columns={[
          {
            key: 'name',
            header: 'Nama',
            priority: 'primary',
            render: (item) => (
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.name}
                </div>
                {item.description && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {item.description}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'maxLimitDownload',
            header: 'Max Limit D/U',
            priority: 'primary',
            render: (item) => (
              <span className="text-sm text-gray-900 dark:text-white">
                {item.maxLimitDownload} / {item.maxLimitUpload}
              </span>
            ),
          },
          {
            key: 'burstLimitDownload',
            header: 'Burst Limit D/U',
            priority: 'secondary',
            render: (item) => (
              item.burstLimitDownload && item.burstLimitUpload ? (
                <span className="text-sm text-gray-900 dark:text-white">
                  {item.burstLimitDownload} / {item.burstLimitUpload}
                </span>
              ) : <span className="text-sm text-gray-500">-</span>
            ),
          },
          {
            key: 'priority',
            header: 'Priority',
            priority: 'secondary',
            render: (item) => (
              <span className="text-sm text-gray-900 dark:text-white">
                {item.priority || '-'}
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            priority: 'primary',
            render: (item) => <StatusBadge status={item.status} />,
          },
        ]}
        keyField="id"
        emptyMessage='Tidak ada data bandwidth. Klik "Tambah Bandwidth" untuk menambahkan.'
        renderActions={(item) => (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handleEdit(item)}
              className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
              title="Edit"
            >
              <HiPencil className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleDelete(item.id)}
              className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="Delete"
            >
              <HiTrash className="w-5 h-5" />
            </button>
          </div>
        )}
      />

      {/* Modal Create/Edit Bandwidth */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={editingBandwidth ? 'Edit Bandwidth' : 'Tambah Bandwidth'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Site Selection in Modal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Site <span className="text-red-500">*</span>
            </label>
            <SiteFilter 
                isInput 
                value={formData.siteId} 
                onSiteChange={(id) => setFormData({ ...formData, siteId: id || '' })} 
            />
             <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Bandwidth ini akan dikaitkan dengan site yang dipilih.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Bandwidth <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Contoh: 10 Mbps"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Format Queue MikroTik:</strong> Pengaturan ini akan digunakan untuk konfigurasi Simple Queue di MikroTik RouterOS.
              Format: angka + unit (contoh: 10M, 10240k, 1G)
            </p>
          </div>

          {/* Max Limit (Wajib) */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Max Limit (Wajib)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Limit Download <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.1"
                    value={formData.maxLimitDownloadValue}
                    onChange={(e) => setFormData({ ...formData, maxLimitDownloadValue: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="10"
                  />
                  <select
                    value={formData.maxLimitDownloadUnit}
                    onChange={(e) => setFormData({ ...formData, maxLimitDownloadUnit: e.target.value as 'k' | 'M' | 'G' | 'T' })}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    <option value="k">k</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="T">T</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Limit Upload <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.1"
                    value={formData.maxLimitUploadValue}
                    onChange={(e) => setFormData({ ...formData, maxLimitUploadValue: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="10"
                  />
                  <select
                    value={formData.maxLimitUploadUnit}
                    onChange={(e) => setFormData({ ...formData, maxLimitUploadUnit: e.target.value as 'k' | 'M' | 'G' | 'T' })}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    <option value="k">k</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="T">T</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Burst Limit (Opsional) */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Burst Limit (Opsional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Burst Limit Download
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.burstLimitDownloadValue}
                    onChange={(e) => setFormData({ ...formData, burstLimitDownloadValue: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="15"
                  />
                  <select
                    value={formData.burstLimitDownloadUnit}
                    onChange={(e) => setFormData({ ...formData, burstLimitDownloadUnit: e.target.value as 'k' | 'M' | 'G' | 'T' })}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    <option value="k">k</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="T">T</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Burst Limit Upload
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.burstLimitUploadValue}
                    onChange={(e) => setFormData({ ...formData, burstLimitUploadValue: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="15"
                  />
                  <select
                    value={formData.burstLimitUploadUnit}
                    onChange={(e) => setFormData({ ...formData, burstLimitUploadUnit: e.target.value as 'k' | 'M' | 'G' | 'T' })}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    <option value="k">k</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="T">T</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Min Limit (Opsional) */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Min Limit (Opsional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Limit Download
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.minLimitDownloadValue}
                    onChange={(e) => setFormData({ ...formData, minLimitDownloadValue: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="5"
                  />
                  <select
                    value={formData.minLimitDownloadUnit}
                    onChange={(e) => setFormData({ ...formData, minLimitDownloadUnit: e.target.value as 'k' | 'M' | 'G' | 'T' })}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    <option value="k">k</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="T">T</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Limit Upload
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.minLimitUploadValue}
                    onChange={(e) => setFormData({ ...formData, minLimitUploadValue: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="5"
                  />
                  <select
                    value={formData.minLimitUploadUnit}
                    onChange={(e) => setFormData({ ...formData, minLimitUploadUnit: e.target.value as 'k' | 'M' | 'G' | 'T' })}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    <option value="k">k</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="T">T</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Burst Threshold (Opsional) */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Burst Threshold (Opsional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Burst Threshold Download
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.burstThresholdDownloadValue}
                    onChange={(e) => setFormData({ ...formData, burstThresholdDownloadValue: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="12"
                  />
                  <select
                    value={formData.burstThresholdDownloadUnit}
                    onChange={(e) => setFormData({ ...formData, burstThresholdDownloadUnit: e.target.value as 'k' | 'M' | 'G' | 'T' })}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    <option value="k">k</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="T">T</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Burst Threshold Upload
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={formData.burstThresholdUploadValue}
                    onChange={(e) => setFormData({ ...formData, burstThresholdUploadValue: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="12"
                  />
                  <select
                    value={formData.burstThresholdUploadUnit}
                    onChange={(e) => setFormData({ ...formData, burstThresholdUploadUnit: e.target.value as 'k' | 'M' | 'G' | 'T' })}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  >
                    <option value="k">k</option>
                    <option value="M">M</option>
                    <option value="G">G</option>
                    <option value="T">T</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Burst Time & Priority */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Burst Time Download (detik)
              </label>
              <input
                type="number"
                min="0"
                value={formData.burstTimeDownload || ''}
                onChange={(e) => setFormData({ ...formData, burstTimeDownload: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Burst Time Upload (detik)
              </label>
              <input
                type="number"
                min="0"
                value={formData.burstTimeUpload || ''}
                onChange={(e) => setFormData({ ...formData, burstTimeUpload: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="15"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority (1-8)
              </label>
              <input
                type="number"
                min="1"
                max="8"
                value={formData.priority || ''}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="8"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Deskripsi
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              rows={3}
              placeholder="Deskripsi bandwidth"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="AKTIF">AKTIF</option>
              <option value="NONAKTIF">NONAKTIF</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {editingBandwidth ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
