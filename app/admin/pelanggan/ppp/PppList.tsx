"use client"

import { useEffect, useState, useCallback } from 'react'
import { HiOutlinePlus, HiPencil, HiTrash, HiArrowPath, HiPrinter, HiArrowPathRoundedSquare, HiNoSymbol, HiXMark, HiMagnifyingGlass, HiOutlineEye } from 'react-icons/hi2'
import Link from 'next/link'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable, { type Column } from '@/components/ui/ResponsiveTable'
import { SiteFilter } from '@/components/common/SiteFilter'
import { toStartOfDay } from '@/lib/utils/datetime'


type PelangganPPP = {
  id: string
  idPelanggan: string
  nama: string
  username: string
  tipe: 'REGULER' | 'NON_REGULER'
  hargaPaketId: string
  hargaPaket?: {
    id: string
    name: string
    harga: number
  } | null
  site?: {
    name: string
  } | null
  tanggalAktif: string
  jatuhTempo: string
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' | 'ISOLIR' | 'DISMANTLE'
  alamat?: string | null
  noTelp?: string | null
  email?: string | null
  createdAt: string
}

export default function PelangganPPPPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pelanggans, setPelanggans] = useState<PelangganPPP[]>([])
  const [disableDuration, setDisableDuration] = useState<number>(5)

  // Filters
  const [siteId, setSiteId] = useState<string | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [limit] = useState(10)

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1) // Reset to first page on search
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Reset page when other filters change
  useEffect(() => {
    setPage(1)
  }, [siteId, statusFilter])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (siteId) params.append('siteId', siteId)
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (statusFilter) params.append('status', statusFilter)
      params.append('page', page.toString())
      params.append('limit', limit.toString())

      const [resPelanggan, resSettings] = await Promise.all([
        fetch(`/api/pelanggan-ppp?${params.toString()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        }),
        fetch('/api/settings/general')
      ])

      if (!resPelanggan.ok) throw new Error('Gagal memuat data pelanggan PPP')

      if (resSettings.ok) {
        try {
          const settingsJson = await resSettings.json()
          const settingsData = settingsJson.data || settingsJson
          if (settingsData.disablePerpanjanganPaket) {
            setDisableDuration(parseInt(settingsData.disablePerpanjanganPaket) || 5)
          }
        } catch (_e) {
          console.error('Error parsing settings:', _e)
        }
      }

      let data: PelangganPPP[] = []
      try {
        const text = await resPelanggan.text()
        if (text) {
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed)) {
            data = parsed
            setTotalPages(1)
          } else if (parsed && parsed.data && Array.isArray(parsed.data)) {
            data = parsed.data
            if (parsed.meta) {
              setTotalPages(Math.ceil((parsed.meta.total || 0) / limit))
            }
          } else if (parsed.error) {
            throw new Error(parsed.error)
          } else {
            data = []
          }
        }
      } catch (_e) {
        throw new Error('Gagal memproses data pelanggan')
      }

      setPelanggans(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data')
    } finally {
      setLoading(false)
    }
  }, [siteId, debouncedSearch, statusFilter, page, limit])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pelanggan ini? Tindakan ini tidak dapat dibatalkan.')) return

    try {
      const res = await fetch(`/api/pelanggan-ppp/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal menghapus pelanggan')
      }
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Terjadi kesalahan saat menghapus data')
    }
  }

  const handleStatusUpdate = async (id: string, newStatus: string, actionName: string) => {
    if (!confirm(`Apakah Anda yakin ingin mengubah status pelanggan ini menjadi ${actionName}? Akses internet akan ${newStatus === 'AKTIF' ? 'diaktifkan' : 'dimatikan'}.`)) return

    try {
      setLoading(true)
      const res = await fetch(`/api/pelanggan-ppp/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal mengubah status')
      }
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengubah status')
    } finally {
      setLoading(false)
    }
  }

  const isRenewalAllowed = (jatuhTempo: string) => {
    const today = new Date()
    today.setTime(toStartOfDay(today).getTime())
    const jatuhTempoDate = new Date(jatuhTempo)
    jatuhTempoDate.setTime(toStartOfDay(jatuhTempoDate).getTime())
    const allowedDate = new Date(jatuhTempoDate)
    allowedDate.setDate(allowedDate.getDate() - disableDuration)
    return today >= allowedDate
  }

  const columns = [
    {
      key: 'nama',
      header: 'Nama Pelanggan',
      render: (item: PelangganPPP) => (
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">{item.nama}</div>
          <div className="text-sm text-gray-500 font-mono mt-0.5">{item.idPelanggan}</div>
          <div className="md:hidden text-xs text-gray-400 mt-1">{item.hargaPaket?.name || '-'}</div>
        </div>
      ),
      priority: 'primary'
    },
    {
      key: 'hargaPaket.name',
      header: 'Paket / Biaya',
      render: (item: PelangganPPP) => (
        <div>
          <div className="font-medium text-gray-800 dark:text-gray-200">
            {item.hargaPaket?.name || '-'} <span className="text-xs font-normal text-gray-400 ml-1">({item.tipe})</span>
          </div>
          <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(item.hargaPaket?.harga || 0)}
          </div>
        </div>
      ),
      priority: 'secondary'
    },
    {
      key: 'site.name',
      header: 'Site Area',
      render: (item: PelangganPPP) => (
        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {item.site?.name || '-'}
        </span>
      ),
      priority: 'tertiary'
    },
    {
      key: 'tanggalAktif',
      header: 'Masa Aktif',
      render: (item: PelangganPPP) => {
        const dueDate = new Date(item.jatuhTempo)
        const diffDays = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

        let statusColor = 'text-white bg-emerald-600 dark:bg-emerald-500'
        let statusText = `${diffDays} hari lagi`

        if (diffDays < 0) {
          statusColor = 'text-white bg-rose-600 dark:bg-rose-500'
          statusText = `Telat ${Math.abs(diffDays)} hari`
        } else if (diffDays <= disableDuration) {
          statusColor = 'text-white bg-amber-600 dark:bg-amber-500'
          statusText = `${diffDays} hari (Akan Habis)`
        }

        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-500">
              Exp: <span className="font-medium text-gray-700 dark:text-gray-300">{dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className={`text-xs font-bold ${statusColor} px-2 py-1 rounded-full inline-block`}>
              {statusText}
            </div>
          </div>
        )
      },
      priority: 'secondary'
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: PelangganPPP) => <StatusBadge status={item.status} />,
      priority: 'primary',
      mobileLabel: 'Status'
    }
  ] as Column<PelangganPPP>[]

  if (loading && pelanggans.length === 0) return <PageLoader />

  return (
    <div className="space-y-6 pb-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pelanggan PPP</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola data dan status akses internet pelanggan PPPoE
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={loadData}
            className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 shadow-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
          >
            <HiArrowPath className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
            Refresh
          </button>
          <Link
            href="/admin/pelanggan/ppp/create"
            className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all"
          >
            <HiOutlinePlus className="-ml-1 mr-2 h-5 w-5 text-white" />
            <span className="text-white">Tambah Pelanggan</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 p-4 border border-rose-200 dark:border-rose-800">
          <div className="flex">
            <HiXMark className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-rose-800 dark:text-rose-200">Terjadi kesalahan</h3>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* FILTER SECTION */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Pencarian</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <HiMagnifyingGlass className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="search"
                className="block w-full rounded-lg border-0 py-2.5 pl-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600 transition-all"
                placeholder="Cari nama, ID, username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full md:w-64">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Site Area</label>
            <SiteFilter
              value={siteId || ''}
              onSiteChange={(id) => setSiteId(id || '')}
              resource="pelanggan"
            />
          </div>
          <div className="w-full md:w-48">
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
            <select
              id="status"
              className="block w-full rounded-lg border-0 py-2.5 pl-3 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600 transition-all"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Semua Status</option>
              <option value="AKTIF">Aktif</option>
              <option value="NONAKTIF">Nonaktif</option>
              <option value="ISOLIR">Isolir</option>
              <option value="DISMANTLE">Dismantle</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <ResponsiveTable
          data={pelanggans}
          columns={columns}
          keyField="id"
          loading={loading}
          emptyMessage={searchQuery ? "Pelanggan tidak ditemukan berdasarkan pencarian Anda." : "Belum ada data pelanggan PPP"}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          renderActions={(item: PelangganPPP) => {
            const allowed = isRenewalAllowed(item.jatuhTempo)
            return (
              <div className="flex items-center justify-end gap-1.5">
                {/* Control Actions */}
                {item.status !== 'ISOLIR' && (
                  <button onClick={() => handleStatusUpdate(item.id, 'ISOLIR', 'ISOLIR')} title="Isolir (Blokir Akses)" className="p-2 text-orange-600 bg-orange-50 hover:bg-orange-100 dark:bg-orange-500/10 dark:hover:bg-orange-500/20 dark:text-orange-400 rounded-lg transition-colors">
                    <HiNoSymbol className="w-4 h-4" />
                  </button>
                )}
                {item.status !== 'DISMANTLE' && (
                  <button onClick={() => handleStatusUpdate(item.id, 'DISMANTLE', 'DISMANTLE')} title="Dismantle (Berhenti Langganan)" className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 rounded-lg transition-colors">
                    <HiXMark className="w-4 h-4" />
                  </button>
                )}
                {['ISOLIR', 'DISMANTLE', 'NONAKTIF'].includes(item.status) && (
                  <button onClick={() => handleStatusUpdate(item.id, 'AKTIF', 'AKTIF')} title="Aktifkan Kembali" className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:text-emerald-400 rounded-lg transition-colors">
                    <HiArrowPath className="w-4 h-4" />
                  </button>
                )}

                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>

                {/* Billing & Edit Actions */}
                <button
                  onClick={() => allowed ? window.location.href = `/admin/pelanggan/ppp/${item.id}/renew` : null}
                  disabled={!allowed}
                  title={allowed ? "Perpanjang Layanan" : `Bisa diperpanjang ${disableDuration} hari sebelum jatuh tempo`}
                  className={`p-2 rounded-lg transition-colors ${allowed ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 dark:text-indigo-400' : 'text-gray-400 bg-gray-50 dark:bg-gray-800 cursor-not-allowed opacity-60'}`}
                >
                  <HiArrowPathRoundedSquare className="w-4 h-4" />
                </button>
                <button onClick={() => window.open(`/admin/pelanggan/ppp/${item.id}/print`, '_blank')} title="Cetak Tagihan" className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 dark:text-purple-400 rounded-lg transition-colors">
                  <HiPrinter className="w-4 h-4" />
                </button>
                <Link href={`/admin/pelanggan/ppp/${item.id}`} title="Detail Pelanggan" className="p-2 text-teal-600 bg-teal-50 hover:bg-teal-100 dark:bg-teal-500/10 dark:hover:bg-teal-500/20 dark:text-teal-400 rounded-lg transition-colors">
                  <HiOutlineEye className="w-4 h-4" />
                </Link>
                <Link href={`/admin/pelanggan/ppp/${item.id}/edit`} title="Edit Pelanggan" className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 rounded-lg transition-colors">
                  <HiPencil className="w-4 h-4" />
                </Link>
                <button onClick={() => handleDelete(item.id)} title="Hapus Pelanggan" className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 rounded-lg transition-colors">
                  <HiTrash className="w-4 h-4" />
                </button>
              </div>
            )
          }}
        />
      </div>
    </div>
  )
}
