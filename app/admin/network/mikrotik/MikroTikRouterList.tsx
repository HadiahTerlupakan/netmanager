"use client"
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineChartBar, HiPencil, HiTrash, HiArrowPath } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { useSocketEvent } from '@/hooks/useSocket'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from 'react-hot-toast'

type MikroTikRouter = {
  id: string
  name: string
  ipAddress: string
  timezone: string
  description: string | null
  pingStatus: string
  userOnline: number
  lastStatusCheck: Date | null
}

type PaginatedResult = {
  routers: MikroTikRouter[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const INITIAL_DATA: PaginatedResult = {
  routers: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0
}

export default function MikroTikRouterList() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // State
  const [data, setData] = useState<PaginatedResult>(INITIAL_DATA)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 500)

  // Pagination State
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // Fetch Data Function
  const fetchRouters = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      if (debouncedSearch) params.append('search', debouncedSearch)

      const res = await fetch(`/api/mikrotik-routers?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch routers')

      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Error loading routers:', error)
      toast.error('Gagal memuat data Router')
    } finally {
      setLoading(false)
    }
  }, [page, limit, debouncedSearch])

  // Initial Load & Refetch on dependencies change
  useEffect(() => {
    fetchRouters()
  }, [fetchRouters])

  // WebSocket Integration
  useSocketEvent('mikrotik:update', (updateData: any) => {
    // When an update occurs, we can either:
    // 1. Refetch the current page to get updated statuses
    // 2. Optimistically update if the payload contains map of IDs -> Status

    // For simplicity and accuracy with pagination, we refetch
    // But we avoid showing loading state to make it seamless
    console.log('Received MikroTik update:', updateData)

    // Silent refetch
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })
    if (debouncedSearch) params.append('search', debouncedSearch)

    fetch(`/api/mikrotik-routers?${params.toString()}`)
      .then(res => res.json())
      .then(result => setData(result))
      .catch(console.error)
  })

  // Handlers
  const handleCheckStatus = async () => {
    try {
      const res = await fetch('/api/mikrotik-routers/check-status', {
        method: 'POST',
      })
      if (res.ok) {
        const result = await res.json()
        toast.success(`Status check completed. Updated ${result.count} routers.`)
        fetchRouters()
      } else {
        const error = await res.json()
        toast.error(error.error || 'Gagal check status')
      }
    } catch (error: any) {
      toast.error('Terjadi kesalahan saat check status')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus router "${name}"?`)) return

    try {
      const res = await fetch(`/api/mikrotik-routers/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'Gagal menghapus router')
        return
      }

      toast.success('Router berhasil dihapus')
      fetchRouters()
    } catch (error: any) {
      toast.error('Gagal menghapus router')
    }
  }

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Router [NAS]</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCheckStatus}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <HiArrowPath className="w-4 h-4" />
            Cek Status Semua Router
          </button>
          <Link
            href="/admin/network/mikrotik/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <span>+</span>
            TAMBAH ROUTER [NAS]
          </Link>
        </div>
      </div>

      {/* INFO Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">INFO:</div>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>Sistem akan mengecek status API connection ke router secara otomatis (Real-time).</li>
        </ul>
      </div>

      {/* Table Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Show</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setPage(1)
              }}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">entries</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Search:</label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search router..."
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
            />
          </div>
        </div>

        {/* Table */}
        <div className={`overflow-x-auto relative ${data.routers.length === 0 ? 'min-h-[200px]' : ''}`}>
          {loading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center z-10">
              <PageLoader />
            </div>
          )}

          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[50px]">

                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[100px]">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Nama Router
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Zona Waktu
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[120px]">
                  User Online
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                  Deskripsi
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Check
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[100px]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {data.routers.length === 0 && !loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="text-gray-400 text-lg">📭</span>
                      <span>{search ? 'Tidak ada router yang sesuai dengan pencarian.' : 'Belum ada data Router.'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data.routers.map((router) => (
                  <tr key={router.id} className="group hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {/* API Test Button */}
                      <button
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Test API Connection"
                      >
                        <HiArrowPath className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${router.pingStatus === 'online'
                          ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                          : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                          }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${router.pingStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {router.pingStatus === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">{router.name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {router.ipAddress}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {router.timezone}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                        <HiOutlineChartBar className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-medium">{router.userOnline} Active</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate hidden md:table-cell">
                      {router.description || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-500">
                      {formatDateTime(router.lastStatusCheck)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/admin/network/mikrotik/${router.id}/edit`}
                          className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <HiPencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(router.id, router.name)}
                          className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {data.total === 0 ? 0 : (page - 1) * limit + 1} to{' '}
            {Math.min(page * limit, data.total)} of {data.total} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {Math.max(1, data.totalPages)}
            </span>
            <button
              onClick={() => setPage((prev) => Math.min(data.totalPages, prev + 1))}
              disabled={page >= data.totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


