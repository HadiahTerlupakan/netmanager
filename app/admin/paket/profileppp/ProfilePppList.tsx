"use client"

import { useEffect, useState, useCallback } from 'react'
import { HiPencil, HiTrash, HiExclamationCircle } from 'react-icons/hi2'
import Modal from '@/components/common/Modal'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import { SiteFilter } from '@/components/common/SiteFilter'

type ProfilePPP = {
  id: string
  name: string
  localAddress: string
  remoteAddress: string
  dnsServer?: string | null
  sessionTimeout?: number | null
  idleTimeout?: number | null
  poolMode?: 'MIKROTIK' | 'RADIUS' | null
  // Rate limit diambil dari Bandwidth yang terkait melalui HargaPaket
  mikroTikRouterId?: string | null
  mikroTikRouter?: {
    id: string
    name: string
    ipAddress: string
  } | null
  description?: string | null
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  createdAt: string
  ipRange?: string | null // IP Range dari MikroTik (format: "192.168.1.100-192.168.1.200")
  siteId?: string | null
  _count?: {
    hargaPakets: number
  }
}

type MikroTikRouter = {
  id: string
  name: string
  ipAddress: string
  siteId?: string
}

type Bandwidth = {
  id: string
  name: string
  maxLimitDownload: string
  maxLimitUpload: string
}

export default function ProfilePPPPage() {
  const [loading, setLoading] = useState(true)
  const [siteId, setSiteId] = useState<string | undefined>(undefined)
  const [profilePPPs, setProfilePPPs] = useState<ProfilePPP[]>([])
  const [mikroTikRouters, setMikroTikRouters] = useState<MikroTikRouter[]>([])
  const [bandwidths, setBandwidths] = useState<Bandwidth[]>([])
  const [pppConnectionMode, setPppConnectionMode] = useState<'RADIUS' | 'MIKROTIK_API'>('RADIUS')
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<ProfilePPP | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    localAddress: '',
    remoteAddress: '',
    ipRangeStart: '', // Range IP awal untuk pool (contoh: "192.168.1.100")
    ipRangeEnd: '', // Range IP akhir untuk pool (contoh: "192.168.1.200")
    dnsServer: '',
    mikroTikRouterId: '',
    bandwidthId: '', // Bandwidth untuk rate limit (opsional)
    poolMode: 'MIKROTIK' as 'MIKROTIK' | 'RADIUS',
    description: '',
    status: 'AKTIF' as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE',
    siteId: '',
  })

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      if (siteId) queryParams.append('siteId', siteId)

      const [profilePPPsRes, routersRes, bandwidthsRes, settingsRes] = await Promise.all([
        fetch(`/api/profileppps?${queryParams.toString()}`),
        fetch('/api/mikrotik-routers'),
        fetch(`/api/bandwidths?${queryParams.toString()}`), // Filter bandwidth by site too
        fetch('/api/settings/general'),
      ])

      if (!profilePPPsRes.ok) {
        let errorMessage = `Gagal memuat data profile PPP: ${profilePPPsRes.status}`
        try {
          const errorData = await profilePPPsRes.json()
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            errorMessage = errorData.error || errorMessage
          }
        } catch (_e: unknown) {
          errorMessage = `Gagal memuat data profile PPP: ${profilePPPsRes.status} ${profilePPPsRes.statusText || ''}`
        }
        throw new Error(errorMessage)
      }

      const profilePPPsData = await profilePPPsRes.json()
      const routersData = routersRes.ok ? await routersRes.json() : { routers: [] }
      const bandwidthsData = bandwidthsRes.ok ? await bandwidthsRes.json() : { data: [] }
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: { pppConnectionMode: 'RADIUS' } }
      const settingsData = settingsJson.data || settingsJson

      setProfilePPPs(profilePPPsData.data || profilePPPsData || [])
      setMikroTikRouters(routersData.data?.routers || routersData.routers || [])
      setBandwidths(bandwidthsData.data || [])
      const pppMode = settingsData.pppConnectionMode || 'RADIUS'
      setPppConnectionMode(pppMode)
      
      // Jika mode bukan RADIUS, paksa poolMode ke MIKROTIK
      if (pppMode !== 'RADIUS') {
        setFormData(prev => ({ ...prev, poolMode: 'MIKROTIK' }))
      }
      
      setError(null)
    } catch (error: unknown) {
      console.error('Error loading data:', error)
      setError(error instanceof Error ? error.message : 'Gagal memuat data')
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
      const url = editingProfile
        ? `/api/profileppps/${editingProfile.id}`
        : '/api/profileppps'
      const method = editingProfile ? 'PUT' : 'POST'

      // Clean data: convert empty strings to undefined for optional fields
      // Gabungkan ipRangeStart dan ipRangeEnd menjadi format "start-end"
      const ipRange = formData.ipRangeStart?.trim() && formData.ipRangeEnd?.trim()
        ? `${formData.ipRangeStart.trim()}-${formData.ipRangeEnd.trim()}`
        : undefined

      const cleanedData = {
        name: formData.name,
        localAddress: formData.localAddress,
        remoteAddress: formData.remoteAddress,
        ipRange: ipRange,
        dnsServer: formData.dnsServer?.trim() || undefined,
        mikroTikRouterId: formData.mikroTikRouterId?.trim() || undefined,
        bandwidthId: formData.bandwidthId?.trim() || undefined, // Bandwidth untuk rate limit
        poolMode: pppConnectionMode === 'RADIUS' ? formData.poolMode : 'MIKROTIK',
        description: formData.description?.trim() || undefined,
        status: formData.status,
        siteId: formData.siteId || undefined,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal menyimpan profile PPP')
      }

      await loadData()
      handleCloseModal()
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Terjadi kesalahan')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus profile PPP ini?')) {
      return
    }

    try {
      const res = await fetch(`/api/profileppps/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal menghapus profile PPP')
        return
      }

      await loadData()
    } catch (error) {
      console.error('Error deleting profile PPP:', error)
      alert('Terjadi kesalahan saat menghapus profile PPP')
    }
  }

  const handleEdit = async (profile: ProfilePPP) => {
    setEditingProfile(profile)

    // Fetch detail profile untuk mendapatkan ipRange dari MikroTik
    let ipRangeStart = ''
    let ipRangeEnd = ''

    try {
      const detailRes = await fetch(`/api/profileppps/${profile.id}`)
      if (detailRes.ok) {
        const detailData = await detailRes.json()
        // Parse ipRange menjadi ipRangeStart dan ipRangeEnd jika ada
        if (detailData.ipRange && detailData.ipRange.trim() !== '') {
          // Format ipRange: "192.168.1.100-192.168.1.200"
          const parts = detailData.ipRange.split('-')
          if (parts.length === 2) {
            ipRangeStart = parts[0].trim()
            ipRangeEnd = parts[1].trim()
          }
        }
      }
    } catch (error: unknown) {
      console.error('Error fetching profile detail:', error)
      // Jika gagal, tetap lanjutkan dengan data yang ada
    }

    setFormData({
      name: profile.name,
      localAddress: profile.localAddress,
      remoteAddress: profile.remoteAddress,
      ipRangeStart: ipRangeStart, // Ambil dari IP Pool di MikroTik
      ipRangeEnd: ipRangeEnd, // Ambil dari IP Pool di MikroTik
      dnsServer: profile.dnsServer || '',
      mikroTikRouterId: profile.mikroTikRouterId || '',
      bandwidthId: '', // Bandwidth tidak disimpan di database, kosongkan saat edit (user bisa pilih ulang)
      poolMode: profile.poolMode || 'MIKROTIK',
      description: profile.description || '',
      status: profile.status,
      siteId: profile.siteId || '',
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingProfile(null)
    setFormData({
      name: '',
      localAddress: '',
      remoteAddress: '',
      ipRangeStart: '',
      ipRangeEnd: '',
      dnsServer: '',
      mikroTikRouterId: '',
      bandwidthId: '',
      poolMode: 'MIKROTIK',
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
        <span className="text-gray-900 dark:text-white">Profile PPP</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile PPP</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola profil PPPoE untuk autentikasi pelanggan
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-48">
            <SiteFilter
              value={siteId || ''}
              onSiteChange={setSiteId}
              resource="profileppp"
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
            Tambah Profile PPP
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
        data={profilePPPs}
        columns={[
          {
            key: 'name',
            header: 'Nama Profile',
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
            key: 'localAddress',
            header: 'Local Address',
            priority: 'primary',
            render: (item) => (
              <span className="text-sm text-gray-900 dark:text-white">
                {item.localAddress}
              </span>
            ),
          },
          {
            key: 'remoteAddress',
            header: 'Remote Address',
            priority: 'primary',
            render: (item) => (
              <span className="text-sm text-gray-900 dark:text-white">
                {item.remoteAddress}
              </span>
            ),
          },
          ...(pppConnectionMode === 'RADIUS' ? [{
            key: 'poolMode',
            header: 'Mode',
            priority: 'secondary' as const,
            render: (item: ProfilePPP) => (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                item.poolMode === 'RADIUS' 
                  ? 'bg-purple-100 text-indigo-800 dark:bg-purple-900/30 dark:text-indigo-300' 
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
              }`}>
                {item.poolMode || 'MIKROTIK'}
              </span>
            ),
          }] : []),
          {
            key: 'dnsServer',
            header: 'DNS Server',
            priority: 'secondary',
            render: (item) => (
              <span className="text-sm text-gray-900 dark:text-white">
                {item.dnsServer || '-'}
              </span>
            ),
          },
          {
            key: 'mikroTikRouter',
            header: 'Target MikroTik',
            priority: 'secondary',
            render: (item) => (
              item.mikroTikRouter ? (
                <div>
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{item.mikroTikRouter.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{item.mikroTikRouter.ipAddress}</div>
                </div>
              ) : (
                <span className="text-sm text-gray-500">-</span>
              )
            ),
          },
          {
            key: 'paketTerkait',
            header: 'Paket Terkait',
            priority: 'secondary',
            render: (item) => (
              <span className="text-sm text-gray-900 dark:text-white">
                {item._count?.hargaPakets || 0} paket
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
        emptyMessage='Tidak ada data profile PPP. Klik "Tambah Profile PPP" untuk menambahkan.'
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

      {/* Modal Create/Edit Profile PPP */}
      <Modal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={editingProfile ? 'Edit Profile PPP' : 'Tambah Profile PPP'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nama Profile <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => {
                const newName = e.target.value
                setFormData({
                  ...formData,
                  name: newName,
                  // Remote Address otomatis sama dengan Nama Profile
                  remoteAddress: newName
                })
              }}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Contoh: Profile-10M"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Nama Profile akan digunakan sebagai nama IP Pool di MikroTik
            </p>
          </div>

          <div>
            <SiteFilter
              value={formData.siteId}
              onSiteChange={(id) => setFormData({ ...formData, siteId: id || '' })}
              isInput
              resource="profileppp"
              className="mb-0"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Local Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.localAddress}
                onChange={(e) => setFormData({ ...formData, localAddress: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="192.168.1.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Remote Address (Nama IP Pool) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.remoteAddress}
                readOnly
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-sm cursor-not-allowed"
                placeholder="Otomatis sama dengan Nama Profile"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Otomatis sama dengan Nama Profile (IP Pool akan dibuat dengan nama ini)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Range IP Awal
              </label>
              <input
                type="text"
                value={formData.ipRangeStart}
                onChange={(e) => setFormData({ ...formData, ipRangeStart: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="192.168.1.100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Range IP Akhir
              </label>
              <input
                type="text"
                value={formData.ipRangeEnd}
                onChange={(e) => setFormData({ ...formData, ipRangeEnd: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="192.168.1.200"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
            Range IP untuk pool. Jika dikosongkan, IP Pool harus sudah dibuat manual di MikroTik.
          </p>

          {pppConnectionMode === 'RADIUS' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mode IP Pool <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.poolMode}
                onChange={(e) => setFormData({ ...formData, poolMode: e.target.value as 'MIKROTIK' | 'RADIUS' })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="MIKROTIK">MIKROTIK (Pool ada di Router)</option>
                <option value="RADIUS">RADIUS (Pool dikelola di Database RADIUS)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Pilih di mana IP Pool dikelola. Mode RADIUS membutuhkan konfigurasi tabel radippool.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              DNS Server
            </label>
            <input
              type="text"
              value={formData.dnsServer}
              onChange={(e) => setFormData({ ...formData, dnsServer: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="8.8.8.8,8.8.4.4"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target MikroTik Router
            </label>
            <select
              value={formData.mikroTikRouterId}
              onChange={(e) => setFormData({ ...formData, mikroTikRouterId: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">-- Pilih Router MikroTik --</option>
              {mikroTikRouters
                .filter(router => !formData.siteId || !router.siteId || router.siteId === formData.siteId)
                .map((router) => (
                  <option key={router.id} value={router.id}>
                    {router.name} ({router.ipAddress})
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Pilih router MikroTik sebagai target untuk profile ini
            </p>
          </div>

          {pppConnectionMode === 'MIKROTIK_API' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bandwidth (untuk Rate Limit)
              </label>
              <select
                value={formData.bandwidthId}
                onChange={(e) => setFormData({ ...formData, bandwidthId: e.target.value })}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="">-- Pilih Bandwidth (Opsional) --</option>
                {bandwidths.map((bandwidth) => (
                  <option key={bandwidth.id} value={bandwidth.id}>
                    {bandwidth.name} ({bandwidth.maxLimitDownload}/{bandwidth.maxLimitUpload})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Pilih Bandwidth untuk rate limit. Jika tidak dipilih, rate limit akan diambil dari HargaPaket yang terkait.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Deskripsi
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              rows={3}
              placeholder="Deskripsi profile PPP"
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
              {editingProfile ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

