'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  HiOutlineArrowPath,
  HiOutlineMagnifyingGlass,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCurrencyDollar,
  HiOutlineDocumentText,
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlineFunnel,
  HiOutlineListBullet
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'

interface IncomePeriodRecord {
  id: string
  invoice: string
  member_id: string
  username: string
  fullname: string
  plan_name: string
  total: string | number
  seller_fee: string | number
  renewed_on: string
  owner_name: string
  trx_status: string
  payment_method: string
  payment_type: string
}

interface IncomePeriodResponse {
  draw: number
  recordsTotal: number
  recordsFiltered: number
  data: IncomePeriodRecord[]
  summary?: {
    profit: string
    feeSeller: string
    totalPlusPpn: string
    totalTransactions: string
  }
}

export default function IncomePeriodClient() {
  const [data, setData] = useState<IncomePeriodRecord[]>([])
  const [summary, setSummary] = useState<IncomePeriodResponse['summary'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Filters
  const [startDate, setStartDate] = useState(() => {
    // Default: Start of current month (Timezone safe)
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-01`
  })
  const [endDate, setEndDate] = useState(() => {
    // Default: Today (Timezone safe)
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [serviceType, setServiceType] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [ownerId, setOwnerId] = useState('all')
  const [owners, setOwners] = useState<{ id: string, name: string }[]>([])
  const [sites, setSites] = useState<{ id: string, name: string }[]>([])
  const [selectedSite, setSelectedSite] = useState('all')
  const [groups, setGroups] = useState<{ id: string, name: string }[]>([])
  const [selectedGroup, setSelectedGroup] = useState('all')

  // Sorting state
  const [sortColumn, setSortColumn] = useState('renewed_on')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Pagination state
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [globalTotal, setGlobalTotal] = useState(0)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0) // Reset to first page on search
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch owners, sites, and groups for filters
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [ownersRes, sitesRes, groupsRes] = await Promise.all([
          fetch('/api/integrations/mixradius/owners'),
          fetch('/api/admin/sites'),
          fetch('/api/integrations/mixradius/groups')
        ])

        if (ownersRes.ok) {
          const result = await ownersRes.json()
          if (result.success && Array.isArray(result.data)) {
            setOwners(result.data)
          }
        }

        if (sitesRes.ok) {
          const result = await sitesRes.json()
          // Check for success property based on API style
          const siteData = result.data || result
          if (Array.isArray(siteData)) {
            setSites(siteData.map((s: any) => ({ id: s.id, name: s.name })))
          }
        }

        if (groupsRes.ok) {
          const result = await groupsRes.json()
          if (result.success && Array.isArray(result.data)) {
            setGroups(result.data)
          }
        }
      } catch (err) {
        console.error('Failed to fetch filter data:', err)
      }
    }
    fetchFilterData()
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        start: (page * pageSize).toString(),
        length: pageSize.toString(),
        search: debouncedSearch,
        sortBy: sortColumn,
        sortDir: sortDirection,
        fdate: startDate,
        tdate: endDate,
      })

      if (serviceType) params.append('stype', serviceType)
      if (paymentMethod) params.append('payment_method', paymentMethod)
      if (ownerId && ownerId !== 'all') params.append('owner_id', ownerId)
      if (selectedSite && selectedSite !== 'all') params.append('siteId', selectedSite)
      if (selectedGroup && selectedGroup !== 'all') params.append('groupId', selectedGroup)

      const response = await fetch(`/api/integrations/mixradius/reports/period?${params}`)

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to fetch data')
      }

      const result = await response.json()
      const responseData = result.data as IncomePeriodResponse

      setData(responseData.data || [])
      setSummary(responseData.summary || null)
      setTotalRecords(responseData.recordsFiltered || 0)
      setGlobalTotal(responseData.recordsTotal || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      toast.error('Gagal mengambil data laporan pendapatan')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, sortColumn, sortDirection, startDate, endDate, serviceType, paymentMethod, ownerId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPages = Math.ceil(totalRecords / pageSize)

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return amount
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSort = (column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column)
    setSortDirection(direction)
    setPage(0)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineCurrencyDollar className="w-7 h-7 text-blue-500" />
            Laporan Pendapatan (MixRadius)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Data pendapatan per periode dari server MixRadius
          </p>
        </div>

        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <HiOutlineArrowPath className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">PROFIT (IDR)</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{summary?.profit || '0'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">FEE SELLER (IDR)</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{summary?.feeSeller || '0'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">TOTAL + PPN (IDR)</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{summary?.totalPlusPpn || '0'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">TOTAL TRANSAKSI</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{globalTotal.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* Date Range */}
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Dari Tanggal</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                        setStartDate(e.target.value)
                        setPage(0)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Sampai Tanggal</label>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                        setEndDate(e.target.value)
                        setPage(0)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Service Type */}
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tipe Layanan</label>
                <select
                    value={serviceType}
                    onChange={(e) => {
                        setServiceType(e.target.value)
                        setPage(0)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Semua Tipe</option>
                    <option value="PPP">PPP / PPPoE</option>
                    <option value="HOTSPOT">Hotspot</option>
                </select>
            </div>

            {/* Payment Method */}
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pembayaran</label>
                <select
                    value={paymentMethod}
                    onChange={(e) => {
                        setPaymentMethod(e.target.value)
                        setPage(0)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">Semua</option>
                    <option value="manual">Manual</option>
                    <option value="online">Online</option>
                </select>
            </div>

            {/* Site Filter */}
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Site</label>
                <select
                    value={selectedSite}
                    onChange={(e) => {
                        setSelectedSite(e.target.value)
                        setPage(0)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">Semua Site</option>
                    {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                            {site.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Management Site (Group) Filter */}
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Manajemen Site</label>
                <select
                    value={selectedGroup}
                    onChange={(e) => {
                        setSelectedGroup(e.target.value)
                        setPage(0)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">Semua Group</option>
                    {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                            {group.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Owner Filter */}
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Owner</label>
                <select
                    value={ownerId}
                    onChange={(e) => {
                        setOwnerId(e.target.value)
                        setPage(0)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">Semua Owner</option>
                    {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                            {owner.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Search */}
            <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Cari</label>
                <div className="relative">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Invoice, user..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-400">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="">
          <ResponsiveTable
            data={data}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            columns={[
              {
                key: 'invoice',
                header: 'Invoice',
                priority: 'primary',
                sortable: true,
                render: (item) => (
                    <div className="flex flex-col">
                        <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">{item.invoice}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{item.payment_method}</span>
                    </div>
                )
              },
              {
                key: 'member_id',
                header: 'Pelanggan',
                priority: 'primary',
                sortable: true,
                render: (item) => (
                    <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">{item.fullname}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{item.username}</span>
                    </div>
                )
              },
              {
                key: 'plan_name',
                header: 'Paket',
                priority: 'secondary',
                sortable: true
              },
              {
                key: 'total',
                header: 'Total',
                priority: 'primary',
                sortable: true,
                render: (item) => (
                    <span className="font-medium text-gray-900 dark:text-white">
                        {formatCurrency(item.total)}
                    </span>
                )
              },
              {
                key: 'seller_fee',
                header: 'Fee',
                priority: 'tertiary',
                sortable: true,
                render: (item) => (
                    <span className="text-gray-500 dark:text-gray-400">
                        {parseInt(String(item.seller_fee)) > 0 ? formatCurrency(item.seller_fee) : '-'}
                    </span>
                )
              },
              {
                key: 'trx_status',
                header: 'Status',
                priority: 'secondary',
                sortable: true,
                render: (item) => (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        item.trx_status === 'PAID'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>
                        {item.trx_status}
                    </span>
                )
              },
              {
                key: 'renewed_on',
                header: 'Tanggal',
                priority: 'secondary',
                sortable: true,
                render: (item) => (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                        <HiOutlineCalendar className="w-4 h-4" />
                        {formatDate(item.renewed_on)}
                    </div>
                )
              },
              {
                key: 'owner_name',
                header: 'Owner',
                priority: 'tertiary',
                sortable: true,
                render: (item) => (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                        <HiOutlineUser className="w-4 h-4" />
                        {item.owner_name}
                    </div>
                )
              },
            ]}
            keyField="id"
            loading={loading}
            emptyMessage={
               <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <HiOutlineMagnifyingGlass className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
                <p>Tidak ada data laporan ditemukan</p>
              </div>
            }
          />
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value))
                setPage(0)
              }}
              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-500 dark:text-gray-400">data</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <HiOutlineChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {page + 1} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <HiOutlineChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
