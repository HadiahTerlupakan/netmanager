"use client"

import { useEffect, useState, useCallback } from 'react'
import { HiOutlinePlus, HiPencil, HiTrash, HiArrowPath, HiPrinter, HiArrowPathRoundedSquare, HiNoSymbol, HiXMark } from 'react-icons/hi2'
import Link from 'next/link'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable, { type Column } from '@/components/ui/ResponsiveTable'
import { SiteFilter } from '@/components/common/SiteFilter'

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
  const [disableDuration, setDisableDuration] = useState<number>(5) // Default 5 days
  const [siteId, setSiteId] = useState<string | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [limit] = useState(10)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch data pelanggan and settings in parallel
      const params = new URLSearchParams()
      if (siteId) params.append('siteId', siteId)
      params.append('page', page.toString())
      params.append('limit', limit.toString())

      const [resPelanggan, resSettings] = await Promise.all([
        fetch(`/api/pelanggan-ppp?${params.toString()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        }),
        fetch('/api/settings/general')
      ])

      if (!resPelanggan.ok) {
        throw new Error('Gagal memuat data pelanggan PPP')
      }

      // Handle settings response
      if (resSettings.ok) {
        try {
          const settingsData = await resSettings.json()
          if (settingsData.disablePerpanjanganPaket) {
            setDisableDuration(parseInt(settingsData.disablePerpanjanganPaket) || 5)
          }
        } catch (e) {
          console.error('Error parsing settings:', e)
        }
      }

      let data: PelangganPPP[] = []
      try {
        const text = await resPelanggan.text()
        if (text) {
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed)) {
            data = parsed
            // Compatibility for array response (no pagination)
             setTotalPages(1) // Should ideally be calculated or unknown
          } else if (parsed && parsed.data && Array.isArray(parsed.data)) {
            data = parsed.data
            if (parsed.meta) {
               setTotalPages(Math.ceil((parsed.meta.total || 0) / limit))
            }
          } else if (parsed.error) {
              throw new Error(parsed.error)
            } else {
               data = []
               console.error('[Frontend] Unexpected API response structure:', parsed)
            }
          }
        } catch (e: unknown) {
          console.error('Error parsing JSON:', e)
          const errorMessage = e instanceof Error ? e.message : 'Gagal memproses data pelanggan'
          throw new Error(errorMessage)
        }
  
        // Debug: Log data yang diterima
        console.log('[Frontend] Data pelanggan diterima:', data.length, 'pelanggan')
        setPelanggans(data)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat data'
        setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [siteId, page, limit])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pelanggan ini? Tindakan ini tidak dapat dibatalkan.')) {
      return
    }

    try {
      // Debug: Log ID yang akan dikirim
      console.log('[Frontend] Menghapus pelanggan dengan ID:', id, 'Type:', typeof id)

      const res = await fetch(`/api/pelanggan-ppp/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorData = await res.json()
        console.error('[Frontend] Error response:', errorData)
        throw new Error(errorData.error || 'Gagal menghapus pelanggan')
      }
      const result = await res.json()
      console.log('[Frontend] Delete berhasil:', result)
      await loadData()
    } catch (err: unknown) {
      console.error('[Frontend] Error saat menghapus:', err)
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat menghapus data'
      alert(errorMessage)
    }
  }

  const handleStatusUpdate = async (id: string, newStatus: string, actionName: string) => {
    if (!confirm(`Apakah Anda yakin ingin mengubah status pelanggan ini menjadi ${actionName}? Akses internet akan ${newStatus === 'AKTIF' ? 'diaktifkan' : 'dimatikan'}.`)) {
      return
    }

    try {
      setLoading(true) // Show global loading or improved localized loading state
      const res = await fetch(`/api/pelanggan-ppp/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal mengubah status')
      }

      const result = await res.json()
      console.log('Status updated:', result)
      await loadData()
    } catch (err: unknown) {
      console.error('Error updating status:', err)
      const errorMessage = err instanceof Error ? err.message : 'Gagal mengubah status'
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleRenewal = (id: string) => {
    // Redirect ke halaman renewal admin
    window.location.href = `/admin/pelanggan/ppp/${id}/renew`
  }

  const handlePrint = (id: string) => {
    // Buka halaman print tagihan di tab baru
    window.open(`/admin/pelanggan/ppp/${id}/print`, '_blank')
  }

  const isRenewalAllowed = (jatuhTempo: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const jatuhTempoDate = new Date(jatuhTempo)
    jatuhTempoDate.setHours(0, 0, 0, 0)

    // Calculate allowed date: jatuhTempo - disableDuration days
    const allowedDate = new Date(jatuhTempoDate)
    allowedDate.setDate(allowedDate.getDate() - disableDuration)

    // Allow if today is past or equal to the allowed start date
    // Also allow if already overdue (handled by logic naturally as today > jatuhTempo > allowedDate)
    return today >= allowedDate
  }

  const columns = [
    {
      key: 'nama',
      header: 'Nama Pelanggan',
      render: (item: PelangganPPP) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{item.nama}</div>
          <div className="text-sm text-gray-500">{item.idPelanggan}</div>
          {/* Mobile only: secondary info */}
          <div className="md:hidden text-xs text-gray-400 mt-1">
             {item.hargaPaket?.name || '-'}
          </div>
        </div>
      ),
      priority: 'primary'
    },
    {
      key: 'hargaPaket.name',
      header: 'Paket',
      render: (item: PelangganPPP) => (
        <div>
          <div className="font-medium">{item.hargaPaket?.name || '-'} ({item.tipe})</div>
          <div className="text-sm text-gray-500">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.hargaPaket?.harga || 0)}</div>
        </div>
      ),
      priority: 'secondary'
    },
    {
        key: 'site.name',
        header: 'Site',
        render: (item: PelangganPPP) => item.site?.name || '-',
        priority: 'tertiary'
    },
    {
      key: 'tanggalAktif',
      header: 'Masa Aktif',
      render: (item: PelangganPPP) => {
        const activeDate = new Date(item.tanggalAktif)
        const dueDate = new Date(item.jatuhTempo)
        const now = new Date()
        
        // Calculate days remaining
        const diffTime = dueDate.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        // Determine status based on days remaining
        let statusColor = 'text-green-600'
        let statusText = `${diffDays} hari lagi`
        
        if (diffDays < 0) {
            statusColor = 'text-red-600'
            statusText = `Telat ${Math.abs(diffDays)} hari`
        } else if (diffDays <= disableDuration) { // Use dynamic setting here
            statusColor = 'text-orange-500' 
            statusText = `${diffDays} hari lagi (Segera Habis)`
        }

        return (
          <div>
            <div className="text-sm">
              <span className="text-gray-500">Aktif: </span>
              {activeDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Exp: </span>
              {dueDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
            </div>
            <div className={`text-xs font-medium mt-1 ${statusColor}`}>
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
      priority: 'primary', // Keep status visible on mobile
      mobileLabel: 'Status'
    }
  ] as Column<PelangganPPP>[]

  if (loading && pelanggans.length === 0) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pelanggan PPP</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola data pelanggan PPPoE dan Hotspot
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link
            href="/admin/pelanggan/ppp/create"
            className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <HiOutlinePlus className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            Tambah Pelanggan
          </Link>
          <button
            onClick={loadData}
            className="inline-flex items-center justify-center rounded-md bg-white dark:bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <HiArrowPath className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="flex">
            <div className="shrink-0">
              <HiXMark className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Terjadi kesalahan</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SiteFilter 
                value={siteId} 
                onSiteChange={setSiteId}
                className="w-full"
            />
            {/* Add more filters here if needed */}
         </div>
      </div>

      <ResponsiveTable
        data={pelanggans}
        columns={columns}
        keyField="id"
        loading={loading}
        emptyMessage="Belum ada data pelanggan PPP"
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        renderActions={(item: PelangganPPP) => {
          const allowed = isRenewalAllowed(item.jatuhTempo)
          return (
            <div className="flex items-center gap-2">
              {item.status !== 'ISOLIR' && (
                <button
                  onClick={() => handleStatusUpdate(item.id, 'ISOLIR', 'ISOLIR')}
                  className="text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300 font-medium inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 transition-colors"
                  title="Isolir (Menunggak)"
                >
                  <HiNoSymbol className="w-4 h-4" />
                </button>
              )}
              {item.status !== 'DISMANTLE' && (
                <button
                  onClick={() => handleStatusUpdate(item.id, 'DISMANTLE', 'DISMANTLE')}
                  className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors"
                  title="Dismantle (Berhenti)"
                >
                  <HiXMark className="w-4 h-4" />
                </button>
              )}
              {['ISOLIR', 'DISMANTLE', 'NONAKTIF'].includes(item.status) && (
                <button
                  onClick={() => handleStatusUpdate(item.id, 'AKTIF', 'AKTIF')}
                  className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 transition-colors"
                  title="Aktifkan Kembali"
                >
                  <HiArrowPath className="w-4 h-4" />
                </button>
              )}
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
              <button
                onClick={() => allowed && handleRenewal(item.id)}
                disabled={!allowed}
                className={`font-medium inline-flex items-center justify-center w-10 h-10 rounded transition-colors ${allowed
                  ? 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                  : 'text-gray-400 cursor-not-allowed opacity-50 bg-gray-50 dark:bg-gray-800'
                  }`}
                title={allowed ? "Perpanjang Layanan" : `Perpanjangan baru bisa dilakukan ${disableDuration} hari sebelum jatuh tempo`}
              >
                <HiArrowPathRoundedSquare className="w-5 h-5" />
              </button>
              <button
                onClick={() => handlePrint(item.id)}
                className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-medium inline-flex items-center justify-center w-10 h-10 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                title="Print Tagihan"
              >
                <HiPrinter className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>
              <Link
                href={`/admin/pelanggan/ppp/${item.id}/edit`}
                className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium inline-flex items-center justify-center w-10 h-10 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                title="Edit"
              >
                <HiPencil className="w-5 h-5" />
              </Link>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium inline-flex items-center justify-center w-10 h-10 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Hapus"
              >
                <HiTrash className="w-5 h-5" />
              </button>
            </div>
          )
        }}
      />
    </div>
  )
}
