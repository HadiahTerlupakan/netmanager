"use client"

import { useEffect, useState } from 'react'
import { HiPencil, HiTrash, HiExclamationCircle, HiStar } from 'react-icons/hi2'
import Modal from '@/components/common/Modal'
import { StatusBadge } from '@/components/common/StatusBadge'

type ProfilePPP = {
  id: string
  name: string
  status?: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
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
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPaket, setEditingPaket] = useState<HargaPaket | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    profilePPPId: '',
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

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [hargaPaketsRes, profilePPPsRes] = await Promise.all([
        fetch('/api/hargapakets'),
        fetch('/api/profileppps'),
      ])

      if (!hargaPaketsRes.ok) {
        let errorMessage = `Gagal memuat data harga paket: ${hargaPaketsRes.status}`
        try {
          const errorData = await hargaPaketsRes.json()
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            errorMessage = errorData.error || errorMessage
          }
        } catch (e) {
          errorMessage = `Gagal memuat data harga paket: ${hargaPaketsRes.status} ${hargaPaketsRes.statusText || ''}`
        }
        throw new Error(errorMessage)
      }

      const hargaPaketsData = await hargaPaketsRes.json()
      const profilePPPsData = await profilePPPsRes.json()

      setHargaPakets(hargaPaketsData)
      setProfilePPPs(profilePPPsData)
      setError(null)
    } catch (error: any) {
      console.error('Error loading data:', error)
      setError(error.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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
    } catch (error: any) {
      alert(error.message || 'Terjadi kesalahan')
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
    } catch (error) {
      console.error('Error deleting paket:', error)
      alert('Terjadi kesalahan saat menghapus paket')
    }
  }

  const handleEdit = (paket: HargaPaket) => {
    setEditingPaket(paket)
    setFormData({
      name: paket.name,
      profilePPPId: paket.profilePPPId,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    )
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
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <span>+</span>
          Tambah Paket
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Nama Paket
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Profile PPP
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Harga
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Durasi
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {hargaPakets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada data paket. Klik "Tambah Paket" untuk menambahkan.
                  </td>
                </tr>
              ) : (
                hargaPakets.map((paket, index) => (
                  <tr key={paket.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {paket.name}
                          </div>
                          {paket.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {paket.description}
                            </div>
                          )}
                        </div>
                        {paket.featured && (
                          <HiStar className="w-5 h-5 text-yellow-500" title="Paket Unggulan" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {paket.profilePPP.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      <div>
                        <div>{formatRupiah(paket.harga)}</div>
                        {paket.useDiscount && paket.discountType && paket.discountValue && (
                          <>
                            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                              - Diskon: {
                                paket.discountType === 'FIXED' 
                                  ? formatRupiah(paket.discountValue)
                                  : `${paket.discountValue}%`
                              } = {
                                formatRupiah(
                                  paket.discountType === 'FIXED'
                                    ? Math.max(0, paket.harga - paket.discountValue)
                                    : Math.round(paket.harga * (1 - paket.discountValue / 100))
                                )
                              }
                            </div>
                            {paket.discountDuration && paket.discountDurationUnit && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Durasi: {paket.discountDuration} {paket.discountDurationUnit === 'JAM' ? 'jam' : paket.discountDurationUnit === 'HARI' ? 'hari' : paket.discountDurationUnit === 'BULAN' ? 'bulan' : 'tahun'}
                              </div>
                            )}
                          </>
                        )}
                        {paket.usePPN && paket.ppnPercentage && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            + PPN {paket.ppnPercentage}% = {
                              formatRupiah(
                                paket.useDiscount && paket.discountType && paket.discountValue
                                  ? Math.round(
                                      (paket.discountType === 'FIXED'
                                        ? Math.max(0, paket.harga - paket.discountValue)
                                        : Math.round(paket.harga * (1 - paket.discountValue / 100))
                                      ) * (1 + paket.ppnPercentage / 100)
                                    )
                                  : Math.round(paket.harga * (1 + paket.ppnPercentage / 100))
                              )
                            }
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {paket.durasi} {paket.durasiUnit === 'JAM' ? 'jam' : paket.durasiUnit === 'HARI' ? 'hari' : paket.durasiUnit === 'BULAN' ? 'bulan' : 'tahun'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={paket.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(paket)}
                          className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Edit"
                        >
                          <HiPencil className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(paket.id)}
                          className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <HiTrash className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                onChange={(e) => setFormData({ ...formData, harga: parseInt(e.target.value) })}
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
                  onChange={(e) => setFormData({ ...formData, durasi: parseInt(e.target.value) })}
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
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
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

