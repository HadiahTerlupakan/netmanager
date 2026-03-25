"use client"

import { useEffect, useState, useCallback } from 'react'
import { HiPencil, HiTrash, HiExclamationCircle, HiStar } from 'react-icons/hi2'
import Modal from '@/components/common/Modal'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import { SiteFilter } from '@/components/common/SiteFilter'

type ProfilePPP = {
  id: string
  name: string
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
}

type Site = {
  id: string
  name: string
  code: string
}

type Bandwidth = {
  id: string
  name: string
  maxLimitDownload: string
  maxLimitUpload: string
}

type HargaPaket = {
  id: string
  name: string
  bandwidthId?: string | null
  bandwidth?: {
    id: string
    name: string
    maxLimitDownload: string
    maxLimitUpload: string
  } | null
  profilePPPId: string
  profilePPP: ProfilePPP
  siteId?: string | null
  site?: Site | null
  harga: number
  durasi: number
  durasiUnit: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'
  usePPN: boolean
  ppnPercentage?: number | null
  useDiscount: boolean
  discountType?: 'FIXED' | 'PERCENT' | null
  discountValue?: number | null
  discountDuration?: number | null
  discountDurationUnit?: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null
  description?: string | null
  featured: boolean
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  createdAt: string
}

export default function HargaPaketPage() {
  const [loading, setLoading] = useState(true)
  const [hargaPakets, setHargaPakets] = useState<HargaPaket[]>([])
  const [profilePPPs, setProfilePPPs] = useState<ProfilePPP[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [bandwidths, setBandwidths] = useState<Bandwidth[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPaket, setEditingPaket] = useState<HargaPaket | null>(null)
  const [siteId, setSiteId] = useState<string | undefined>(undefined)
  const [formData, setFormData] = useState({
    name: '',
    profilePPPId: '',
    bandwidthId: '' as string | null,
    siteId: '' as string | null,
    harga: 0,
    durasi: 30,
    durasiUnit: 'HARI' as 'JAM' | 'HARI' | 'BULAN' | 'TAHUN',
    usePPN: false,
    ppnPercentage: null as number | null,
    useDiscount: false,
    discountType: 'FIXED' as 'FIXED' | 'PERCENT' | null,
    discountValue: null as number | null,
    discountDuration: null as number | null,
    discountDurationUnit: null as 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null,
    description: '',
    featured: false,
    status: 'AKTIF' as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE',
  })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (siteId) params.append('siteId', siteId)

      const [hargaPaketsRes, profilePPPsRes, sitesRes, bandwidthsRes, settingsRes] = await Promise.all([
        fetch(`/api/hargapakets?${params.toString()}`),
        fetch(`/api/profileppps?${params.toString()}`),
        fetch('/api/admin/sites'),
        fetch(`/api/bandwidths?${params.toString()}`),
        fetch('/api/settings/general'),
      ])

      if (!hargaPaketsRes.ok) {
        let errorMessage = `Gagal memuat data harga paket: ${hargaPaketsRes.status}`
        try {
          const errorData = await hargaPaketsRes.json()
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            errorMessage = errorData.error || errorMessage
          }
        } catch (_e) {
          errorMessage = `Gagal memuat data harga paket: ${hargaPaketsRes.status} ${hargaPaketsRes.statusText || ''}`
        }
        throw new Error(errorMessage)
      }

      const hargaPaketsData = await hargaPaketsRes.json()
      const profilePPPsData = await profilePPPsRes.json()
      const sitesData = await sitesRes.json()
      const bandwidthsData = await bandwidthsRes.json()
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: { pppConnectionMode: 'RADIUS' } }
      const settingsData = settingsJson.data || settingsJson

      setHargaPakets(hargaPaketsData.data || hargaPaketsData)
      setProfilePPPs(profilePPPsData.data || profilePPPsData)
      setSites(sitesData.data || sitesData)
      setBandwidths(bandwidthsData.data || bandwidthsData)
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

    // Validate form data
    if (formData.durasi < 1) {
      alert('Durasi minimal 1')
      return
    }
    if (formData.harga < 0) {
      alert('Harga tidak boleh negatif')
      return
    }

    try {
      const url = editingPaket
        ? `/api/hargapakets/${editingPaket.id}`
        : '/api/hargapakets'
      const method = editingPaket ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal menyimpan harga paket')
      }

      await loadData()
      handleCloseModal()
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Terjadi kesalahan'
      alert(errorMsg)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus paket ini?')) {
      return
    }

    try {
      const res = await fetch(`/api/hargapakets/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal menghapus paket')
        return
      }

      await loadData()
    } catch (_error) {
      console.error('Error deleting paket:', _error)
      alert('Terjadi kesalahan saat menghapus paket')
    }
  }

  const handleEdit = (paket: HargaPaket) => {
    setEditingPaket(paket)
    setFormData({
      name: paket.name,
      profilePPPId: paket.profilePPPId,
      bandwidthId: paket.bandwidthId || null,
      siteId: paket.siteId || null,
      harga: paket.harga,
      durasi: paket.durasi,
      durasiUnit: paket.durasiUnit || 'HARI',
      usePPN: paket.usePPN || false,
      ppnPercentage: paket.ppnPercentage || null,
      useDiscount: paket.useDiscount || false,
      discountType: paket.discountType || 'FIXED',
      discountValue: paket.discountValue || null,
      discountDuration: paket.discountDuration || null,
      discountDurationUnit: paket.discountDurationUnit || null,
      description: paket.description || '',
      featured: paket.featured,
      status: paket.status,
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingPaket(null)
    setFormData({
      name: '',
      profilePPPId: '',
      bandwidthId: null,
      siteId: null,
      harga: 0,
      durasi: 30,
      durasiUnit: 'HARI',
      usePPN: false,
      ppnPercentage: null,
      useDiscount: false,
      discountType: 'FIXED',
      discountValue: null,
      discountDuration: null,
      discountDurationUnit: null,
      description: '',
      featured: false,
      status: 'AKTIF',
    })
  }

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span>
        <span>Paket</span> <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white">Harga Paket</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Harga Paket</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola paket internet dengan harga dan durasi
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-48">
            <SiteFilter onSiteChange={setSiteId} value={siteId ?? ''} resource="harga" />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <span>+</span>
            Tambah Paket
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
      {loading ? (
        <div className="flex justify-center py-20">
          <PageLoader />
        </div>
      ) : (
        <ResponsiveTable
          data={hargaPakets}
          columns={[
            {
              key: 'name',
              header: 'Nama Paket',
              priority: 'primary',
              render: (item) => (
                <div className="flex items-center gap-2">
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
                  {item.featured && (
                    <HiStar className="w-5 h-5 text-yellow-500" title="Paket Unggulan" />
                  )}
                </div>
              ),
            },
            {
              key: 'profilePPP',
              header: 'Profile PPP',
              priority: 'secondary',
              render: (item) => (
                <div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {item.profilePPP.name}
                  </div>
                  {item.bandwidth && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      BW: {item.bandwidth.name}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'site',
              header: 'Site',
              priority: 'secondary',
              render: (item) => (
                <span className="text-sm text-gray-900 dark:text-white">
                  {item.site?.name || '-'}
                </span>
              ),
            },
            {
              key: 'harga',
              header: 'Harga',
              priority: 'primary',
              render: (item) => (
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  <div>{formatRupiah(item.harga)}</div>
                  {item.useDiscount && item.discountType && item.discountValue && (
                    <>
                      <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                        - Diskon: {
                          item.discountType === 'FIXED'
                            ? formatRupiah(item.discountValue)
                            : `${item.discountValue}%`
                        } = {
                          formatRupiah(
                            item.discountType === 'FIXED'
                              ? Math.max(0, item.harga - item.discountValue)
                              : Math.round(item.harga * (1 - item.discountValue / 100))
                          )
                        }
                      </div>
                      {item.discountDuration && item.discountDurationUnit && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Durasi: {item.discountDuration} {item.discountDurationUnit === 'JAM' ? 'jam' : item.discountDurationUnit === 'HARI' ? 'hari' : item.discountDurationUnit === 'BULAN' ? 'bulan' : 'tahun'}
                        </div>
                      )}
                    </>
                  )}
                  {item.usePPN && item.ppnPercentage && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      + PPN {item.ppnPercentage}% = {
                        formatRupiah(
                          item.useDiscount && item.discountType && item.discountValue
                            ? Math.round(
                              (item.discountType === 'FIXED'
                                ? Math.max(0, item.harga - item.discountValue)
                                : Math.round(item.harga * (1 - item.discountValue / 100))
                              ) * (1 + item.ppnPercentage / 100)
                            )
                            : Math.round(item.harga * (1 + item.ppnPercentage / 100))
                        )
                      }
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'durasi',
              header: 'Durasi',
              priority: 'secondary',
              render: (item) => (
                <span className="text-sm text-gray-900 dark:text-white">
                  {item.durasi} {item.durasiUnit === 'JAM' ? 'jam' : item.durasiUnit === 'HARI' ? 'hari' : item.durasiUnit === 'BULAN' ? 'bulan' : 'tahun'}
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
          emptyMessage='Tidak ada data paket. Klik "Tambah Paket" untuk menambahkan.'
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
      )}

      {/* Modal Create/Edit Harga Paket */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={editingPaket ? 'Edit Paket' : 'Tambah Paket'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Paket <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Contoh: Paket 10 Mbps"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Profile PPP <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.profilePPPId}
              onChange={(e) => setFormData({ ...formData, profilePPPId: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">-- Pilih Profile PPP --</option>
              {profilePPPs
                .filter((p) => p.status === 'AKTIF')
                .map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bandwidth
            </label>
            <select
              value={formData.bandwidthId || ''}
              onChange={(e) => setFormData({ ...formData, bandwidthId: e.target.value || null })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">-- Pilih Bandwidth (Opsional) --</option>
              {bandwidths.map((bw) => (
                <option key={bw.id} value={bw.id}>
                  {bw.name} ({bw.maxLimitDownload}/{bw.maxLimitUpload})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Jika dipilih, rate limit akan mengikuti bandwidth ini. Jika kosong, akan menggunakan setting di Profile PPP.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Site
            </label>
            <select
              value={formData.siteId || ''}
              onChange={(e) => setFormData({ ...formData, siteId: e.target.value || null })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">-- Pilih Site (Opsional) --</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Harga (Rp) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.harga}
                onChange={(e) => setFormData({ ...formData, harga: e.target.value ? parseInt(e.target.value) : 0 })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="300000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Durasi <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.durasi}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    setFormData({ ...formData, durasi: isNaN(val) ? 0 : val })
                  }}
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="30"
                />
                <select
                  required
                  value={formData.durasiUnit}
                  onChange={(e) => setFormData({ ...formData, durasiUnit: e.target.value as 'JAM' | 'HARI' | 'BULAN' })}
                  className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                >
                  <option value="JAM">Jam</option>
                  <option value="HARI">Hari</option>
                  <option value="BULAN">Bulan</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="usePPN"
                checked={formData.usePPN}
                onChange={(e) => setFormData({
                  ...formData,
                  usePPN: e.target.checked,
                  ppnPercentage: e.target.checked ? formData.ppnPercentage : null
                })}
                className="rounded border-gray-300 dark:border-gray-700"
              />
              <label htmlFor="usePPN" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Gunakan PPN
              </label>
            </div>
            {formData.usePPN && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Persentase PPN (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required={formData.usePPN}
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.ppnPercentage || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    ppnPercentage: e.target.value ? parseFloat(e.target.value) : null
                  })}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="11"
                />
                {formData.usePPN && formData.ppnPercentage && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    PPN: {formatRupiah(Math.round(formData.harga * (formData.ppnPercentage / 100)))}
                    {' '}(Total: {formatRupiah(Math.round(formData.harga * (1 + formData.ppnPercentage / 100)))})
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="useDiscount"
                checked={formData.useDiscount}
                onChange={(e) => setFormData({
                  ...formData,
                  useDiscount: e.target.checked,
                  discountType: e.target.checked ? (formData.discountType || 'FIXED') : 'FIXED',
                  discountValue: e.target.checked ? formData.discountValue : null
                })}
                className="rounded border-gray-300 dark:border-gray-700"
              />
              <label htmlFor="useDiscount" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Gunakan Diskon
              </label>
            </div>
            {formData.useDiscount && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Jenis Diskon <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="discountType"
                        value="FIXED"
                        checked={formData.discountType === 'FIXED'}
                        onChange={(e) => setFormData({
                          ...formData,
                          discountType: e.target.value as 'FIXED' | 'PERCENT',
                          discountValue: null // Reset value saat ganti jenis
                        })}
                        className="border-gray-300 dark:border-gray-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Fixed (Nominal Tetap)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="discountType"
                        value="PERCENT"
                        checked={formData.discountType === 'PERCENT'}
                        onChange={(e) => setFormData({
                          ...formData,
                          discountType: e.target.value as 'FIXED' | 'PERCENT',
                          discountValue: null // Reset value saat ganti jenis
                        })}
                        className="border-gray-300 dark:border-gray-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Persen (%)</span>
                    </label>
                  </div>
                </div>
                {formData.discountType && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nilai Diskon {formData.discountType === 'FIXED' ? '(Rp)' : '(%)'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required={formData.useDiscount}
                      min="0"
                      max={formData.discountType === 'PERCENT' ? 100 : undefined}
                      step={formData.discountType === 'PERCENT' ? '0.01' : '1'}
                      value={formData.discountValue || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        discountValue: e.target.value ? parseFloat(e.target.value) : null
                      })}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                      placeholder={formData.discountType === 'FIXED' ? '50000' : '10'}
                    />
                    {formData.useDiscount && formData.discountType && formData.discountValue && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Diskon: {
                          formData.discountType === 'FIXED'
                            ? formatRupiah(formData.discountValue)
                            : `${formData.discountValue}% (${formatRupiah(Math.round(formData.harga * (formData.discountValue / 100)))})`
                        }
                        {' '}(Harga Setelah Diskon: {
                          formatRupiah(
                            formData.discountType === 'FIXED'
                              ? Math.max(0, formData.harga - formData.discountValue)
                              : Math.round(formData.harga * (1 - formData.discountValue / 100))
                          )
                        })
                      </p>
                    )}
                  </div>
                )}
                {formData.useDiscount && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Durasi Diskon <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        required={formData.useDiscount}
                        min="1"
                        value={formData.discountDuration || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          discountDuration: e.target.value ? parseInt(e.target.value) : null
                        })}
                        className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                        placeholder="30"
                      />
                      <select
                        required={formData.useDiscount}
                        value={formData.discountDurationUnit || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          discountDurationUnit: e.target.value as 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null
                        })}
                        className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                      >
                        <option value="">-- Pilih Unit --</option>
                        <option value="JAM">Jam</option>
                        <option value="HARI">Hari</option>
                        <option value="BULAN">Bulan</option>
                        <option value="TAHUN">Tahun</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
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
              placeholder="Deskripsi paket"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="featured"
              checked={formData.featured}
              onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
              className="rounded border-gray-300 dark:border-gray-700"
            />
            <label htmlFor="featured" className="text-sm text-gray-700 dark:text-gray-300">
              Paket Unggulan
            </label>
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
              {editingPaket ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

