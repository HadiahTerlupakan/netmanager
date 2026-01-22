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
  HiOutlineXMark
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'

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
}

interface MixRadiusResponse {
  draw: number
  recordsTotal: number
  recordsFiltered: number
  data: MixRadiusCustomer[]
}

export default function MixRadiusClient() {
  const { hasPermission } = usePermission() 
  const [data, setData] = useState<MixRadiusCustomer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState('all') // all, member_id, username, fullname
  const [debouncedSearch, setDebouncedSearch] = useState('')
  
  // Pagination state
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)

  // Detail modal state
  const [selectedCustomer, setSelectedCustomer] = useState<MixRadiusCustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // Fetch customer detail
  const fetchCustomerDetail = async (customerId: string) => {
    setDetailLoading(true)
    setShowDetailModal(true)
    
    try {
      const response = await fetch(`/api/integrations/mixradius/customers/${customerId}`)
      
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to fetch detail')
      }

      const result = await response.json()
      setSelectedCustomer(result.data)
    } catch (err: any) {
      toast.error('Gagal mengambil detail pelanggan')
      setShowDetailModal(false)
    } finally {
      setDetailLoading(false)
    }
  }

  // Close modal
  const closeDetailModal = () => {
    setShowDetailModal(false)
    setSelectedCustomer(null)
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0) // Reset to first page on search
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        start: (page * pageSize).toString(),
        length: pageSize.toString(),
        search: debouncedSearch,
        searchType: searchType,
      })

      const response = await fetch(`/api/integrations/mixradius/customers?${params}`)
      
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Failed to fetch data')
      }

      const result: MixRadiusResponse = await response.json()
      setData(result.data)
      setTotalRecords(result.recordsFiltered)
    } catch (err: any) {
      setError(err.message)
      toast.error('Gagal mengambil data dari MixRadius')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, searchType])

  useEffect(() => {
    fetchData()
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

  const getTrxStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            PAID
          </span>
        )
      case 'UNPAID':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            UNPAID
          </span>
        )
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            {status}
          </span>
        )
    }
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineCloud className="w-7 h-7 text-blue-500" />
            MixRadius Integration
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Data pelanggan PPP dari sistem eksternal MixRadius
          </p>
        </div>

        <button
          onClick={fetchData}
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
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Pelanggan</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalRecords.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Halaman</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{page + 1} / {totalPages || 1}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Source</div>
          <div className="text-lg font-medium text-blue-600 dark:text-blue-400">sblnet.topsetting.com</div>
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
        <div className="">
          <ResponsiveTable
            data={data}
            columns={[
              { key: 'member_id', header: 'ID', priority: 'primary', minWidth: '100px', className: 'font-mono' },
              {
                key: 'fullname',
                header: 'Nama',
                priority: 'primary',
                render: (item) => (
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{item.fullname}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{item.phonenumber}</div>
                  </div>
                )
              },
              { key: 'username', header: 'Username', priority: 'secondary', className: 'font-mono' },
              {
                key: 'plan_name',
                header: 'Paket',
                priority: 'secondary',
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
                render: (item) => getStatusBadge(item.auth_status)
              },
              {
                key: 'trx_status',
                header: 'Pembayaran',
                priority: 'secondary',
                render: (item) => getTrxStatusBadge(item.trx_status)
              },
              {
                key: 'expired_on',
                header: 'Expired',
                priority: 'secondary',
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
              { key: 'owner_name', header: 'Owner', priority: 'tertiary' },
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
      {showDetailModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity"
              onClick={closeDetailModal}
            />

            {/* Modal */}
            <div className="relative inline-block w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <HiOutlineEye className="w-5 h-5 text-blue-500" />
                  Detail Pelanggan
                </h3>
                <button
                  onClick={closeDetailModal}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <HiOutlineXMark className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-4">
                {detailLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <HiOutlineArrowPath className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : selectedCustomer ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Personal Info */}
                      <div className="col-span-1 md:col-span-2">
                         <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 border-b pb-1">Info Pribadi</h4>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID Pelanggan</label>
                        <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{selectedCustomer.member_id}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Username</label>
                        <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{selectedCustomer.username}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Lengkap</label>
                        <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{selectedCustomer.fullname}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">No. Identitas (KTP/SIM)</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedCustomer.identity_number || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedCustomer.email || '-'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">No. Telepon</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedCustomer.phonenumber || '-'}</p>
                      </div>
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alamat</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{selectedCustomer.address || '-'}</p>
                      </div>

                      {/* Service Info */}
                      <div className="col-span-1 md:col-span-2 mt-2">
                         <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 border-b pb-1">Layanan & Pembayaran</h4>
                      </div>
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Paket Langganan</label>
                        <p className="mt-1 text-sm font-bold text-blue-600 dark:text-blue-400">{selectedCustomer.plan_name}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipe Pelanggan</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white uppercase">{selectedCustomer.subscription_type?.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipe Pembayaran</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedCustomer.payment_type}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status Bayar</label>
                        <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          selectedCustomer.trx_status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedCustomer.trx_status}
                        </span>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status Akun</label>
                         <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          selectedCustomer.auth_status === 'Enabled-Users' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedCustomer.auth_status === 'Enabled-Users' ? 'AKTIF' : 'NON-AKTIF'}
                        </span>
                      </div>
                      
                      {/* Dates */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Diperbaharui</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedCustomer.renewed_on}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jatuh Tempo</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedCustomer.expired_on}</p>
                      </div>

                      {/* Technical */}
                      <div className="col-span-1 md:col-span-2 mt-2">
                         <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 border-b pb-1">Teknis</h4>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bind MAC</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">{selectedCustomer.bind_mac}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">MAC / Caller ID</label>
                        <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white">{selectedCustomer.mac_address || '-'}</p>
                      </div>
                      {selectedCustomer.note && (
                        <div className="col-span-1 md:col-span-2">
                           <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Catatan</label>
                           <p className="mt-1 text-sm text-gray-900 dark:text-white italic">{selectedCustomer.note}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    Tidak ada data
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={closeDetailModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
