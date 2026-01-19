"use client"

import { useEffect, useState } from 'react'
import { HiOutlinePlus, HiPencil, HiTrash, HiArrowPath, HiPrinter, HiArrowPathRoundedSquare, HiOutlineCalendar, HiOutlineExclamationTriangle, HiNoSymbol, HiXMark } from 'react-icons/hi2'
import Link from 'next/link'
import { StatusBadge } from '@/components/common/StatusBadge'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
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

  useEffect(() => {
    loadData()
  }, [siteId])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch data pelanggan and settings in parallel
      const params = new URLSearchParams()
      if (siteId) params.append('siteId', siteId)
      
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

      let data = []
      try {
        const text = await resPelanggan.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.error('Error parsing JSON:', e)
        data = []
      }

      // Debug: Log data yang diterima
      console.log('[Frontend] Data pelanggan diterima:', data.length, 'pelanggan')
      setPelanggans(data || [])
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data')
    } finally {
      setLoading(false)
    }
  }

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
    } catch (err: any) {
      console.error('[Frontend] Error saat menghapus:', err)
      alert(err.message || 'Terjadi kesalahan saat menghapus data')
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
      console.log('[Frontend] Status updated:', result)
      await loadData() // Reload to reflect changes
      alert(`Status berhasil diubah menjadi ${actionName}`)

    } catch (err: any) {
      console.error('[Frontend] Error update status:', err)
      alert(err.message || 'Terjadi kesalahan saat mengubah status')
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

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const isJatuhTempo = (jatuhTempo: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const jatuhTempoDate = new Date(jatuhTempo)
    jatuhTempoDate.setHours(0, 0, 0, 0)
    return jatuhTempoDate < today
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

  // if (loading) {
  //   return <PageLoader />
  // }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pelanggan PPP</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Kelola data pelanggan yang menggunakan koneksi PPPoE
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-full md:w-48">
                <SiteFilter onSiteChange={setSiteId} />
            </div>
            <Link
              href="/admin/pelanggan/ppp/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <HiOutlinePlus className="w-4 h-4" />
          Tambah Pelanggan
        </Link>
        </div>
      </div>

      <ResponsiveTable
        data={pelanggans}
        keyField="id"
        loading={loading}
        loadingMessage="Memuat data pelanggan PPP..."
        emptyMessage={
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Belum ada data pelanggan PPP
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Klik &quot;Tambah Pelanggan&quot; untuk menambahkan pelanggan baru
            </p>
          </div>
        }
        columns={[
          {
            key: 'idPelanggan',
            header: 'ID PELANGGAN',
            priority: 'primary',
            render: (item: PelangganPPP) => (
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                <Link href={`/admin/pelanggan/ppp/${item.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  {item.idPelanggan}
                </Link>
              </div>
            )
          },
          {
            key: 'nama',
            header: 'NAMA',
            priority: 'primary',
            render: (item: PelangganPPP) => (
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  <Link href={`/admin/pelanggan/ppp/${item.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                    {item.nama}
                  </Link>
                </div>
                {item.email && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.email}
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'site',
            header: 'SITE',
            priority: 'secondary',
            render: (item: PelangganPPP) => (
                <div className="text-sm text-gray-900 dark:text-white">
                    {item.site?.name || '-'}
                </div>
            )
          },
          {
            key: 'username',
            header: 'USERNAME',
            priority: 'secondary',
            render: (item: PelangganPPP) => <span className="text-sm text-gray-900 dark:text-white">{item.username}</span>
          },
          {
            key: 'tipe',
            header: 'TIPE',
            priority: 'secondary',
            render: (item: PelangganPPP) => (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.tipe === 'REGULER'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                  }`}
              >
                {item.tipe === 'REGULER' ? (
                  <span className="flex items-center gap-1"><HiOutlineCalendar className="w-3 h-3" /> Reguler</span>
                ) : (
                  <span className="flex items-center gap-1"><HiArrowPath className="w-3 h-3" /> Non Reguler</span>
                )}
              </span>
            )
          },
          {
            key: 'paket',
            header: 'PAKET',
            priority: 'secondary',
            render: (item: PelangganPPP) => (
              <div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {item.hargaPaket?.name || '-'}
                </div>
                {item.hargaPaket && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatRupiah(item.hargaPaket.harga)}
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'activeDate',
            header: 'TGL AKTIF',
            priority: 'tertiary',
            render: (item: PelangganPPP) => <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(item.tanggalAktif)}</span>
          },
          {
            key: 'dueDate',
            header: 'JATUH TEMPO',
            priority: 'primary',
            render: (item: PelangganPPP) => (
              <div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {formatDate(item.jatuhTempo)}
                </div>
                {isJatuhTempo(item.jatuhTempo) && (
                  <div className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                    <div className="flex items-center gap-1">
                      <HiOutlineExclamationTriangle className="w-3 h-3" /> Jatuh Tempo
                    </div>
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'status',
            header: 'STATUS',
            priority: 'primary',
            render: (item: PelangganPPP) => <StatusBadge status={item.status} />
          }
        ]}
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
