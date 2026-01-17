"use client"
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { HiOutlineChartBar, HiPencil, HiTrash, HiArrowPath, HiCog6Tooth } from 'react-icons/hi2'
import ReconfigureModal from '@/components/mikrotik/ReconfigureModal'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import TestConnectionModal from '@/components/mikrotik/TestConnectionModal'
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

  // Test Connection State
  const [showTestModal, setShowTestModal] = useState(false)
  const [showReconfigureModal, setShowReconfigureModal] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

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

  const handleTestConnection = async (id: string) => {
    setIsTesting(true)
    setShowTestModal(true)
    setTestResult(null)

    try {
      const res = await fetch('/api/mikrotik-routers/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routerId: id }),
      })

      const result = await res.json()
      setTestResult(result)

      if (res.ok && result.success) {
        fetchRouters() // Refresh status in table
      }
    } catch (error: any) {
      console.error('Test connection error:', error)
      setTestResult({
        success: false,
        api: { success: false, message: 'Error: ' + (error.message || 'Unknown error') },
        message: 'Terjadi kesalahan saat test koneksi',
      })
    } finally {
      setIsTesting(false)
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Router [NAS]</h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowReconfigureModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <HiCog6Tooth className="w-4 h-4" />
            Reconfigurasi Mikrotik
          </button>
          <Link
            href="/admin/network/mikrotik/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <span>+</span>
            Tambah Router
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
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
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
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">Search:</label>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search router..."
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
        </div>

        {/* Table */}
        <ResponsiveTable
          loading={loading}
          data={data.routers}
          columns={[
            {
              key: 'status',
              header: 'Status',
              priority: 'primary',
              render: (router) => (
                <div className="text-center">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${router.pingStatus === 'online'
                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                      : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                      }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${router.pingStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {router.pingStatus === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
              )
            },
            {
              key: 'name',
              header: 'Nama Router',
              priority: 'primary',
              render: (router) => <div className="text-sm font-semibold text-gray-900 dark:text-white">{router.name}</div>
            },
            {
              key: 'ipAddress',
              header: 'IP Address',
              priority: 'primary',
              render: (router) => <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">{router.ipAddress}</div>
            },
            {
              key: 'timezone',
              header: 'Zona Waktu',
              priority: 'secondary',
              render: (router) => <div className="text-sm text-gray-600 dark:text-gray-400">{router.timezone}</div>
            },
            {
              key: 'userOnline',
              header: 'User Online',
              priority: 'secondary',
              render: (router) => (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                  <HiOutlineChartBar className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">{router.userOnline} Active</span>
                </div>
              )
            },
            {
              key: 'description',
              header: 'Deskripsi',
              priority: 'tertiary',
              render: (router) => <div className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{router.description || '-'}</div>
            },
            {
              key: 'lastStatusCheck',
              header: 'Last Check',
              priority: 'secondary',
              render: (router) => <div className="text-xs text-gray-500 dark:text-gray-500">{formatDateTime(router.lastStatusCheck)}</div>
            }
          ]}
          keyField="id"
          emptyMessage={search ? 'Tidak ada router yang sesuai dengan pencarian.' : 'Belum ada data Router.'}
          renderActions={(router) => (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => handleTestConnection(router.id)}
                className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                title="Test API Connection"
              >
                <HiArrowPath className="w-5 h-5" />
              </button>
              <Link
                href={`/admin/network/mikrotik/${router.id}/edit`}
                className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                title="Edit"
              >
                <HiPencil className="w-5 h-5" />
              </Link>
              <button
                onClick={() => handleDelete(router.id, router.name)}
                className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                title="Delete"
              >
                <HiTrash className="w-5 h-5" />
              </button>
            </div>
          )}
        />

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
      <TestConnectionModal
        open={showTestModal}
        onClose={() => setShowTestModal(false)}
        result={testResult}
        isLoading={isTesting}
      />
      <ReconfigureModal 
        open={showReconfigureModal}
        onClose={() => setShowReconfigureModal(false)}
        onSuccess={() => {
             setShowReconfigureModal(false)
             fetchRouters()
        }}
      />
    </div>
  )
}


