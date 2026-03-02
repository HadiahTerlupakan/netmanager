'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  HiOutlineArrowPath,
  HiOutlineMagnifyingGlass,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCloud,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
  HiOutlineEye,
  HiUserCircle,
  HiWifi,
  HiClock,
  HiBolt,
  HiOutlineTrash
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { Modal, ModalFooter } from '@/components/ui/Modal'

interface MixRadiusCustomerDetail {
  id: string
  member_id: string
  username: string
  fullname: string
  email: string
  phonenumber: string
  address: string
  plan_name: string
  payment_type: string
  auth_status: string
  subscription_type: string
  trx_status: string
  identity_number: string
  renewed_on: string
  expired_on: string
  note: string
  bind_mac: string
  mac_address: string
  latitude: string
  longitude: string
  // Extended fields
  odp_name?: string
  owner_name?: string
  service_type?: string
  ip_type?: string
  portal_password?: string
  expired_action?: string
  uptime?: string
  quota_usage?: string
  online?: boolean
  invoices?: MixRadiusInvoice[]
}

export interface MixRadiusInvoice {
  id: string
  invoice_number: string
  plan_name: string
  amount: string
  activation_date: string
  deadline_date: string
  owner: string
  status: string
}

interface MixRadiusCustomer {
  id: string
  member_id: string
  username: string
  fullname: string
  email: string
  phonenumber: string
  address: string
  plan_name: string
  type: string
  payment_type: string
  auth_status: string
  expired_on: string
  renewed_on: string
  created_at: string
  total: string | number
  trx_status: string
  trx_invoice: string
  owner_name: string
  online?: boolean
  active_session_ip?: string
}

interface MixRadiusResponse {
  draw: number
  recordsTotal: number
  recordsFiltered: number
  data: MixRadiusCustomer[]
}

interface MixRadiusGroup {
  id: string
  name: string
}

interface MixRadiusOwner {
  id: string
  name: string
}

export interface MixRadiusClientProps {
  defaultStatus?: string
  viewMode?: 'default' | 'isolir'
}

export default function MixRadiusClient({ defaultStatus, viewMode = 'default' }: MixRadiusClientProps) {
  const [data, setData] = useState<MixRadiusCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState('all') // all, member_id, username, fullname
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [onlineFilter, setOnlineFilter] = useState('all') // all, online, offline
  const [statusFilter, setStatusFilter] = useState('all') // all, Enabled-Users, Disabled-Users
  const [owners, setOwners] = useState<MixRadiusOwner[]>([])
  const [selectedOwner, setSelectedOwner] = useState('all')
  const [groups, setGroups] = useState<MixRadiusGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Sorting state
  const [sortColumn, setSortColumn] = useState('expired_on')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Pagination state
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [globalTotal, setGlobalTotal] = useState(0)

  // Detail modal state
  const [selectedCustomer, setSelectedCustomer] = useState<MixRadiusCustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'invoices'>('profile')

  // Dismantle state
  const [showDismantleModal, setShowDismantleModal] = useState(false)
  const [dismantleReason, setDismantleReason] = useState('')
  const [dismantleNotes, setDismantleNotes] = useState('')
  const [processingDismantle, setProcessingDismantle] = useState(false)

  const DISMANTLE_REASONS = [
    "Telat Bayar",
    "Pindah Rumah",
    "Pindah ke Provider Lain",
    "Sering Gangguan",
    "Pelayanan Pelanggan Buruk",
    "Kebutuhan Menurun",
    "Harga Terlalu Mahal",
    "Kecepatan Tidak Sesuai Janji",
    "Tidak Ada Keterangan",
  ]

  // Invoice counts state with Initial Load from LocalStorage
  const [invoiceCounts, setInvoiceCounts] = useState<Record<string, { paidCount: number, totalCount: number }>>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('mixradius_invoice_counts')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          // Simple validation: Ensure it's an object and not too old (optional)
          return parsed
        } catch (e) {
          console.error('Failed to parse cached invoice counts', e)
        }
      }
    }
    return {}
  })

  // Sync to LocalStorage whenever invoiceCounts change
  useEffect(() => {
    if (Object.keys(invoiceCounts).length > 0) {
      localStorage.setItem('mixradius_invoice_counts', JSON.stringify(invoiceCounts))
    }
  }, [invoiceCounts])

  // Fetch invoice counts for visible data - PROGRESSIVE LOADING
  useEffect(() => {
    if (data.length === 0) return

    const fetchCountsProgressively = async () => {
      const ids = data.map(d => d.id)
      const CHUNK_SIZE = 1 // Fetch 1 by 1 as requested (non-aggressive)

      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunkIds = ids.slice(i, i + CHUNK_SIZE)

        // Build validationData for this chunk (Smart-Cache Sync)
        const chunkValidationData: Record<string, string> = {}
        chunkIds.forEach(id => {
          const customer = data.find(d => d.id === id)
          if (customer?.renewed_on) {
            chunkValidationData[id] = customer.renewed_on
          }
        })

        try {
          const res = await fetch('/api/integrations/mixradius/invoice-counts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerIds: chunkIds,
              validationData: chunkValidationData,
              bypassCache: isRefreshing // Manual bypass still available
            })
          })
          const json = await res.json()
          if (json.data) {
            setInvoiceCounts(prev => ({ ...prev, ...json.data }))
          }
        } catch (err) {
          console.error(`Failed to fetch invoice counts for chunk starting at ${i}`, err)
        }
      }
      if (isRefreshing) setIsRefreshing(false)
    }

    const timer = setTimeout(fetchCountsProgressively, 500)
    return () => clearTimeout(timer)
  }, [data, isRefreshing])


  // Fetch customer detail
  const fetchCustomerDetail = async (customerId: string) => {
    setDetailLoading(true)
    setShowDetailModal(true)

    try {
      const response = await fetch(`/api/integrations/mixradius/customers/${customerId}`)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Gagal mengambil detail pelanggan')
      }

      const result = await response.json()
      setSelectedCustomer(result.data)
    } catch (_err) {
      const errMsg = _err instanceof Error ? _err.message : 'Gagal mengambil detail pelanggan'
      toast.error(errMsg)
      setShowDetailModal(false)
    } finally {
      setDetailLoading(false)
    }
  }

  // Close modal
  const closeDetailModal = () => {
    setShowDetailModal(false)
    setSelectedCustomer(null)
    setShowDismantleModal(false)
    setDismantleReason('')
    setDismantleNotes('')
  }

  const handleDismantle = async () => {
    if (!selectedCustomer || !dismantleReason) {
      toast.error('Mohon pilih alasan bongkar')
      return
    }

    if (!confirm(`Apakah Anda yakin ingin mengajukan bongkar untuk pelanggan ${selectedCustomer.username}?`)) {
      return
    }

    setProcessingDismantle(true)
    try {
      const response = await fetch('/api/integrations/mixradius/dismantle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          reason: dismantleReason,
          notes: dismantleNotes
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Gagal mengajukan dismantle')
      }

      const result = await response.json()
      toast.success(result.message || 'Permintaan bongkar berhasil dibuat')
      closeDetailModal()

      // Refresh list to potentially show updated status (though MixRadius status might not change immediately)
      fetchData(true)
    } catch (err: unknown) {
      const error = err as { message: string }
      toast.error(error.message || 'Terjadi kesalahan')
    } finally {
      setProcessingDismantle(false)
    }
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0) // Reset to first page on search
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch owners for filter
  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const response = await fetch('/api/integrations/mixradius/owners')
        const result = await response.json()

        if (response.ok) {
          setOwners(result.data || [])
        } else {
          // If it's a config error, it might be reported in global error or handled here
          console.warn('Owners fetch failed:', result.error)
          if (result.details?.isConfigError) {
            setError(result.error)
          }
        }
      } catch (err) {
        console.error('Failed to fetch owners', err)
      }
    }
    fetchOwners()

    const fetchGroups = async () => {
      try {
        const response = await fetch('/api/integrations/mixradius/groups')
        const result = await response.json()

        if (response.ok) {
          setGroups(result.data || [])
        } else {
          console.warn('Groups fetch failed:', result.error)
          if (result.details?.isConfigError) {
            setError(result.error)
          }
        }
      } catch (err) {
        console.error('Failed to fetch groups', err)
      }
    }
    fetchGroups()
  }, [])

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        start: (page * pageSize).toString(),
        length: pageSize.toString(),
        search: debouncedSearch,
        searchType: searchType,
        sortBy: sortColumn,
        sortDir: sortDirection,
        forceRefresh: forceRefresh.toString()
      })

      if (defaultStatus) {
        params.append('authStatus', defaultStatus)
      } else if (statusFilter !== 'all') {
        params.append('authStatus', statusFilter)
      }

      if (onlineFilter !== 'all') {
        params.append('onlineStatus', onlineFilter)
      }

      if (selectedOwner !== 'all') {
        params.append('ownerName', selectedOwner)
      }

      if (selectedGroup !== 'all') {
        params.append('groupId', selectedGroup)
      }

      const response = await fetch(`/api/integrations/mixradius/customers?${params}`)

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Gagal mengambil data pelanggan')
      }

      const result = await response.json()
      // API uses apiSuccess() which wraps response in {success, data: {...}}
      const responseData = result.data as MixRadiusResponse
      setData(responseData.data || [])
      setTotalRecords(responseData.recordsFiltered || 0)
      setGlobalTotal(responseData.recordsTotal || 0)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Gagal mengambil data dari MixRadius'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, searchType, defaultStatus, statusFilter, onlineFilter, selectedOwner, selectedGroup, sortColumn, sortDirection])

  const clearCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mixradius_invoice_counts')
      setInvoiceCounts({})
      setIsRefreshing(true)
      toast.success('Cache dibersihkan. Memuat data terbaru dari server...')
    }
  }, [])

  useEffect(() => {
    fetchData(false)
  }, [fetchData])

  const totalPages = Math.ceil(totalRecords / pageSize)

  const getStatusBadge = (status: string) => {
    if (status === 'Enabled-Users') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <HiOutlineCheckCircle className="w-3 h-3" />
          Active
        </span>
      )
    } else if (status === 'Disabled-Users') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          <HiOutlineXCircle className="w-3 h-3" />
          Disabled
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        {status}
      </span>
    )
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const isExpired = (dateStr: string) => {
    if (!dateStr) return false
    return new Date(dateStr) < new Date()
  }

  const handleSort = (column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column)
    setSortDirection(direction)
    setPage(0) // Reset to first page on sort change
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineCloud className="w-7 h-7 text-blue-500" />
            {viewMode === 'isolir' ? 'MixRadius Isolir' : 'MixRadius Integration'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {viewMode === 'isolir'
              ? 'Daftar pelanggan Isolir (Non-Aktif/Disabled)'
              : 'Data pelanggan PPP dari sistem eksternal MixRadius'}
          </p>
        </div>

        <button
          onClick={() => fetchData(true)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <HiOutlineArrowPath className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Memuat...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {viewMode === 'isolir' ? 'Total Pelanggan Isolir' : 'Total Pelanggan'}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {totalRecords.toLocaleString()}
            {viewMode === 'isolir' && (
              <span className="text-sm text-gray-500 dark:text-gray-400 font-normal ml-2">
                / {globalTotal.toLocaleString()} Total
              </span>
            )}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Halaman</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{page + 1} / {totalPages || 1}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex flex-col justify-between">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Source</div>
            <div className="text-lg font-medium text-blue-600 dark:text-blue-400">sblnet.topsetting.com</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearCache}
            className="mt-2 flex items-center gap-2"
            title="Hapus cache dan ambil data terbaru dari MixRadius"
          >
            <HiOutlineXCircle className="w-3.5 h-3.5" />
            Bersihkan Cache
          </Button>
        </div>
      </div>

      {/* Search with Filter */}
      <div className="flex gap-2">
        <select
          value={searchType}
          onChange={(e) => {
            setSearchType(e.target.value)
            setPage(0)
          }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
        >
          <option value="all">Semua</option>
          <option value="member_id">ID Pelanggan</option>
          <option value="username">Username</option>
          <option value="fullname">Nama</option>
          <option value="phonenumber">No. HP</option>
          <option value="address">Alamat</option>
        </select>

        <select
          value={onlineFilter}
          onChange={(e) => {
            setOnlineFilter(e.target.value)
            setPage(0)
          }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
        >
          <option value="all">Semua Koneksi</option>
          <option value="online">Online Saja</option>
          <option value="offline">Offline Saja</option>
        </select>

        {!defaultStatus && (
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(0)
            }}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
          >
            <option value="all">Semua Status</option>
            <option value="Enabled-Users">Aktif (Enabled)</option>
            <option value="Disabled-Users">Non-Aktif (Disabled)</option>
            <option value="Isolir">Isolir (Expired)</option>
          </select>
        )}

        <select
          value={selectedGroup}
          onChange={(e) => {
            setSelectedGroup(e.target.value)
            setPage(0)
          }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
        >
          <option value="all">Manajemen Site</option>
          {Array.isArray(groups) && groups.map(group => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>

        <select
          value={selectedOwner}
          onChange={(e) => {
            setSelectedOwner(e.target.value)
            setPage(0)
          }}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
        >
          <option value="all">Semua NAS</option>
          {Array.isArray(owners) && owners.map(owner => (
            <option key={owner.id} value={owner.name}>{owner.name}</option>
          ))}
        </select>

        <div className="relative flex-1">
          <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={searchType === 'all' ? 'Cari nama, username, ID...' : `Cari berdasarkan ${searchType === 'member_id' ? 'ID' : searchType === 'fullname' ? 'nama' : searchType}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
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
        <div>
          <ResponsiveTable
            data={data}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            columns={viewMode === 'isolir' ? [
              { key: 'member_id', header: 'ID Pelanggan', priority: 'primary', minWidth: '100px', className: 'font-mono font-bold', sortable: true },
              { key: 'fullname', header: 'Nama Pelanggan', priority: 'primary', className: 'font-medium', sortable: true },
              { key: 'phonenumber', header: 'Nomor Tlp', priority: 'primary', className: 'font-mono', sortable: true },
              { key: 'address', header: 'Alamat', priority: 'secondary', className: 'text-sm max-w-xs truncate', sortable: true },
              {
                key: 'expired_on',
                header: 'Jatuh Tempo',
                priority: 'secondary',
                sortable: true,
                render: (item) => (
                  <div className={`text-sm ${isExpired(item.expired_on) ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-900 dark:text-white'}`}>
                    {formatDate(item.expired_on)}
                  </div>
                )
              },
              {
                key: 'online',
                header: 'Online',
                priority: 'primary',
                sortable: true,
                render: (item) => (
                  <div className="flex flex-col">
                    {item.online ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 w-fit">
                        Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500 w-fit">
                        Offline
                      </span>
                    )}
                    {item.active_session_ip && (
                      <span className="text-[9px] text-gray-400 font-mono mt-0.5">{item.active_session_ip}</span>
                    )}
                  </div>
                )
              },
              {
                key: 'created_at',
                header: 'Berlangganan',
                priority: 'primary',
                sortable: true,
                render: (item) => {
                  const count = invoiceCounts[item.id]
                  if (!count) return (
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <HiOutlineArrowPath className="w-3 h-3 animate-spin" />
                      <span className="text-[10px]">Memuat...</span>
                    </div>
                  )
                  return (
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {count.paidCount} Bulan
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Total {count.totalCount} Invoice
                      </span>
                    </div>
                  )
                }
              },
              { key: 'owner_name', header: 'Owner', priority: 'tertiary', sortable: true },
            ] : [
              { key: 'member_id', header: 'ID', priority: 'primary', minWidth: '100px', className: 'font-mono', sortable: true },
              {
                key: 'fullname',
                header: 'Nama',
                priority: 'primary',
                sortable: true,
                render: (item) => (
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{item.fullname}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.phonenumber}</div>
                  </div>
                )
              },
              { key: 'username', header: 'Username', priority: 'secondary', className: 'font-mono', sortable: true },
              {
                key: 'plan_name',
                header: 'Paket',
                priority: 'secondary',
                sortable: true,
                render: (item) => (
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{item.plan_name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.payment_type}</div>
                  </div>
                )
              },
              {
                key: 'auth_status',
                header: 'Status',
                priority: 'secondary',
                sortable: true,
                render: (item) => getStatusBadge(item.auth_status)
              },
              {
                key: 'online',
                header: 'Online',
                priority: 'primary',
                sortable: true,
                render: (item) => (
                  <div className="flex flex-col">
                    {item.online ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 w-fit">
                        Online
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500 w-fit">
                        Offline
                      </span>
                    )}
                    {item.active_session_ip && (
                      <span className="text-[9px] text-gray-400 font-mono mt-0.5">{item.active_session_ip}</span>
                    )}
                  </div>
                )
              },
              {
                key: 'created_at',
                header: 'Berlangganan',
                priority: 'secondary',
                sortable: true,
                render: (item) => {
                  const count = invoiceCounts[item.id]
                  if (!count) return (
                    <div className="flex items-center gap-1 text-gray-400">
                      <HiOutlineArrowPath className="w-3 h-3 animate-spin" />
                      <span className="text-[9px]">Memuat...</span>
                    </div>
                  )
                  return (
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        {count.paidCount} Bulan
                      </span>
                      <span className="text-[9px] text-gray-400">
                        ID: {item.id}
                      </span>
                    </div>
                  )
                }
              },
              {
                key: 'expired_on',
                header: 'Expired',
                priority: 'secondary',
                sortable: true,
                render: (item) => (
                  <div>
                    <div className={`text-sm ${isExpired(item.expired_on) ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {formatDate(item.expired_on)}
                    </div>
                    {isExpired(item.expired_on) && (
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <HiOutlineClock className="w-3 h-3" />
                        Expired
                      </span>
                    )}
                  </div>
                )
              },
              { key: 'owner_name', header: 'Owner', priority: 'tertiary', sortable: true },
            ]}
            keyField="id"
            loading={loading}
            renderActions={(item) => (
              <button
                onClick={() => fetchCustomerDetail(item.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Lihat Detail"
              >
                <HiOutlineEye className="w-4 h-4" />
                <span className="hidden sm:inline">Detail</span>
              </button>
            )}
            emptyMessage={
              <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                <HiOutlineMagnifyingGlass className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
                <p>Tidak ada data ditemukan</p>
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


      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          closeDetailModal()
          setActiveTab('profile')
        }}
        title="Detail Pelanggan"
        description="Informasi lengkap data pelanggan dari MixRadius"
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <HiOutlineArrowPath className="w-10 h-10 animate-spin text-blue-500" />
          </div>
        ) : selectedCustomer ? (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Profil Pelanggan
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'invoices'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
              >
                Riwayat Tagihan & Invoice
              </button>
            </div>

            {activeTab === 'profile' ? (
              /* PROFILE TAB */
              <div className="space-y-6">
                {/* Personal Info */}
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <HiUserCircle className="w-5 h-5 text-gray-500" />
                    Info Pribadi
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">ID Pelanggan</label>
                      <p className="text-sm font-mono font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1.5 rounded-md border border-gray-100 dark:border-gray-700 inline-block">
                        {selectedCustomer.member_id}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Username</label>
                      <p className="text-sm font-mono font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1.5 rounded-md border border-gray-100 dark:border-gray-700 inline-block">
                        {selectedCustomer.username}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Nama Lengkap</label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedCustomer.fullname}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">No. Identitas</label>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedCustomer.identity_number || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Email</label>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedCustomer.email || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">No. Telepon</label>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedCustomer.phonenumber || '-'}</p>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Alamat</label>
                      <p className="text-sm text-gray-900 dark:text-white leading-relaxed">{selectedCustomer.address || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Online Status Alert */}
                {selectedCustomer.online && (
                  <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3 animate-pulse">
                    <div className="p-2 bg-green-100 dark:bg-green-800 rounded-full">
                      <HiWifi className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-green-800 dark:text-green-300">Perangkat Online</h4>
                      <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400">
                        <span>Uptime: {selectedCustomer.uptime || '-'}</span>
                        {selectedCustomer.quota_usage && <span>| Quota: {selectedCustomer.quota_usage}</span>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Service Info */}
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <HiWifi className="w-5 h-5 text-gray-500" />
                    Layanan & Pembayaran
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Paket Langganan</label>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 text-sm font-bold text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 rounded-full border border-blue-100 dark:border-blue-800">
                          {selectedCustomer.plan_name}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Jenis Layanan</label>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedCustomer.service_type || 'PPPOE'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Tipe IP</label>
                      <p className="text-sm text-gray-900 dark:text-white uppercase">{selectedCustomer.ip_type?.replace('automatic', 'DYNAMIC') || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Tipe Pelanggan</label>
                      <p className="text-sm text-gray-900 dark:text-white uppercase">{selectedCustomer.subscription_type?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Pembayaran</label>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedCustomer.payment_type}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Status Bayar</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedCustomer.trx_status === 'PAID'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                        {selectedCustomer.trx_status}
                      </span>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Status Akun</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${selectedCustomer.auth_status === 'Enabled-Users'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                        {selectedCustomer.auth_status === 'Enabled-Users' ? 'AKTIF' : 'NON-AKTIF'}
                      </span>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Diperbaharui</label>
                      <p className="text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                        <HiClock className="w-4 h-4 text-gray-400" />
                        {selectedCustomer.renewed_on}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Jatuh Tempo</label>
                      <p className="text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                        <HiClock className="w-4 h-4 text-gray-400" />
                        {selectedCustomer.expired_on}
                      </p>
                    </div>
                    {selectedCustomer.expired_action && (
                      <div className="col-span-1 md:col-span-2">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Aksi Jatuh Tempo</label>
                        <p className="text-sm text-gray-900 dark:text-white italic">
                          {selectedCustomer.expired_action}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Technical Info */}
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <HiBolt className="w-5 h-5 text-gray-500" />
                    Teknis & Perangkat
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Owner Data / Reseller</label>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedCustomer?.owner_name?.split('—')?.[0]?.trim() || '-'}</p>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">ODP / POP</label>
                      <p className="text-sm font-mono text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800/50 p-2 rounded border border-gray-100 dark:border-gray-700 whitespace-pre-wrap">
                        {selectedCustomer.odp_name || '-'}
                      </p>
                    </div>
                    {/* Stats */}
                    {selectedCustomer.uptime && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Waktu Online (Uptime)</label>
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">{selectedCustomer.uptime}</p>
                      </div>
                    )}
                    {selectedCustomer.quota_usage && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Kuota Terpakai</label>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{selectedCustomer.quota_usage}</p>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Bind MAC</label>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedCustomer.bind_mac}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">MAC / Caller ID</label>
                      <p className="text-sm font-mono font-medium text-gray-900 dark:text-white">{selectedCustomer.mac_address || '-'}</p>
                    </div>
                    {selectedCustomer.portal_password && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Password Portal</label>
                        <p className="text-sm font-mono text-gray-900 dark:text-white">{selectedCustomer.portal_password}</p>
                      </div>
                    )}

                    {selectedCustomer.note && (
                      <div className="col-span-1 md:col-span-2">
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">Catatan</label>
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-100 dark:border-yellow-800/30">
                          <p className="text-sm text-gray-700 dark:text-gray-300 italic">{selectedCustomer.note}</p>
                        </div>
                      </div>
                    )}

                    {/* Dismantle Button Area */}
                    <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => {
                          setDismantleReason(DISMANTLE_REASONS[0])
                          setShowDismantleModal(true)
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl transition-colors font-bold"
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                        Bongkar Pelanggan (Dismantle)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* INVOICES TAB */
              <div>
                {selectedCustomer.invoices && selectedCustomer.invoices.length > 0 ? (
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Paket</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Periode</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jumlah</th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {selectedCustomer.invoices.map((inv, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">
                              {inv.invoice_number}<br />
                              <span className="text-xs text-gray-500">#{inv.id}</span>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">{inv.plan_name}</td>
                            <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs">Aktif: {inv.activation_date}</span>
                                <span className="text-xs text-red-500">Exp: {inv.deadline_date}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-sm font-bold text-gray-900 dark:text-white">{inv.amount}</td>
                            <td className="px-3 py-3 text-sm">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                Detail
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    Belum ada data invoice
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center">
            <HiOutlineCloud className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Tidak ada data pelanggan yang dipilih</p>
          </div>
        )}

        <ModalFooter>
          <button
            type="button"
            onClick={closeDetailModal}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Tutup
          </button>
          {/* Future: Add "Sync Now" button here if needed in Phase 5 part 2 */}
        </ModalFooter>
      </Modal>

      {/* Dismantle Modal */}
      <Modal
        isOpen={showDismantleModal}
        onClose={() => setShowDismantleModal(false)}
        title="Konfirmasi Bongkar Pelanggan"
        description={`Ajukan permintaan bongkar perangkat untuk ${selectedCustomer?.username}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Alasan Bongkar
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {DISMANTLE_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${dismantleReason === reason
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                  <input
                    type="radio"
                    name="dismantleReason"
                    value={reason}
                    checked={dismantleReason === reason}
                    onChange={(e) => setDismantleReason(e.target.value)}
                    className="h-4 w-4 text-red-600 border-gray-300 focus:ring-red-500"
                  />
                  <span className={`ml-3 text-sm ${dismantleReason === reason
                      ? 'font-medium text-red-900 dark:text-red-300'
                      : 'text-gray-700 dark:text-gray-300'
                    }`}>
                    {reason}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Catatan Tambahan (Opsional)
            </label>
            <textarea
              value={dismantleNotes}
              onChange={(e) => setDismantleNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:ring-red-500 focus:border-red-500 sm:text-sm"
              placeholder="Tambahkan catatan untuk tim teknis..."
            />
          </div>
        </div>

        <ModalFooter>
          <button
            type="button"
            onClick={() => setShowDismantleModal(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            disabled={processingDismantle}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDismantle}
            disabled={processingDismantle || !dismantleReason}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processingDismantle ? (
              <>
                <HiOutlineArrowPath className="w-4 h-4 mr-2 animate-spin" />
                Memproses...
              </>
            ) : (
              'Ya, Ajukan Bongkar'
            )}
          </button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
