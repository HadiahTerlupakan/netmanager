'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  HiOutlineArrowPath,
  HiOutlineMagnifyingGlass,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCurrencyDollar,
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlineCog
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import FeeConfigurationModal, { FeeConfig } from './FeeConfigurationModal'
import { DUITKU_DEFAULT_FEES, normalizePaymentMethod } from './DuitkuDefaults'

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
  nasporttype: string
  method: string
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
  const [groups, setGroups] = useState<{ id: string, name: string }[]>([])
  const [selectedGroup, setSelectedGroup] = useState('all')

  // Fee Config State
  const [feeConfig, setFeeConfig] = useState<FeeConfig>({})
  const [showFeeModal, setShowFeeModal] = useState(false)
  const [netIncome, setNetIncome] = useState<number>(0)
  const [estGatewayFee, setEstGatewayFee] = useState<number>(0)
  const [isCalculatingNet, setIsCalculatingNet] = useState(false)

  // Sorting state
  const [sortColumn, setSortColumn] = useState('renewed_on')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Pagination state
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalRecords, setTotalRecords] = useState(0)
  const [_globalTotal, setGlobalTotal] = useState(0)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0) // Reset to first page on search
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch owners for filters & Fees
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [ownersRes, groupsRes, feesRes] = await Promise.all([
          fetch('/api/integrations/mixradius/owners'),
          fetch('/api/integrations/mixradius/groups'),
          fetch('/api/integrations/mixradius/fees')
        ])

        if (ownersRes.ok) {
          const result = await ownersRes.json()
          if (result.success && Array.isArray(result.data)) {
            setOwners(result.data)
          }
        }

        if (groupsRes.ok) {
          const result = await groupsRes.json()
          if (result.success && Array.isArray(result.data)) {
            setGroups(result.data)
          }
        }

        if (feesRes.ok) {
            const result = await feesRes.json()
            if (result.success) {
                setFeeConfig(result.data)
            }
        }
      } catch (err) {
        console.error('Failed to fetch filter data:', err)
      }
    }
    fetchFilterData()
  }, [])

  // Move helper functions outside or use useCallback to stabilize them
  const parseNumber = useCallback((val: string | number): number => {
    if (typeof val === 'number') return val
    if (!val) return 0

    let str = String(val).trim()
    str = str.replace(/Rp\.?\s?/i, '')

    if (str.includes(',')) {
        str = str.replace(/\./g, '').replace(',', '.')
    }
    else if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
        str = str.replace(/\./g, '')
    }

    return parseFloat(str) || 0
  }, [])

  const calculateNetIncome = useCallback((records: IncomePeriodRecord[]) => {
      let totalNet = 0
      let totalFee = 0
      records.forEach(r => {
          const rawTotal = parseNumber(r.total)
          const feeSeller = parseNumber(r.seller_fee)
          const method = r.payment_method || r.method || ''

          // Check if transaction is Online (Payment Gateway)
          const isOnline = method.toLowerCase().includes('dtk') ||
                           method.toLowerCase().includes('tripay') ||
                           method.toLowerCase().includes('midtrans') ||
                           method.toLowerCase().includes('xendit') ||
                           r.payment_type?.toLowerCase() === 'online';

          // Normalize method name for matching
          // Case insensitive match
          let fee = 0

          // Find matching config
          const configKey = Object.keys(feeConfig).find(k => k.toLowerCase() === method.toLowerCase())

          if (configKey) {
              // 1. Primary: Use Manual Configuration (Applies to ANY method if configured)
              const conf = feeConfig[configKey]
              if (conf.type === 'FIXED') {
                  fee = conf.value
              } else {
                  fee = rawTotal * (conf.value / 100)
              }
          } else if (isOnline) {
              // 2. Fallback: Use Duitku Defaults ONLY for Online Transactions
              const duitkuCode = normalizePaymentMethod(method)
              if (duitkuCode && DUITKU_DEFAULT_FEES[duitkuCode]) {
                  const defaultFee = DUITKU_DEFAULT_FEES[duitkuCode]
                  if (defaultFee.type === 'FIXED') {
                      fee = defaultFee.value
                  } else {
                      fee = rawTotal * (defaultFee.value / 100)
                  }
              }
          }
          // Manual transactions without config get 0 fee

          // Net = Total - FeeSeller - PaymentGatewayFee
          totalNet += (rawTotal - feeSeller - fee)
          totalFee += fee
      })
      return { net: totalNet, fee: totalFee }
  }, [feeConfig, parseNumber])

  // Calculate Global Net Income (Fetch all data in background)
  useEffect(() => {
      if (totalRecords === 0) {
          setNetIncome(0)
          setEstGatewayFee(0)
          return
      }

      const calcGlobal = async () => {
          setIsCalculatingNet(true)
          try {
              const params = new URLSearchParams({
                start: '0',
                length: '10000', // Fetch all for calculation
                search: debouncedSearch,
                sortBy: sortColumn,
                sortDir: sortDirection,
                fdate: startDate,
                tdate: endDate,
              })

              if (serviceType) params.append('stype', serviceType)
              if (paymentMethod) params.append('payment_method', paymentMethod)
              if (ownerId && ownerId !== 'all') params.append('owner_id', ownerId)
              if (selectedGroup && selectedGroup !== 'all') params.append('groupId', selectedGroup)

              const response = await fetch(`/api/integrations/mixradius/reports/period?${params}`)
              const result = await response.json()

              if (result.success && result.data?.data) {
                  const allData = result.data.data as IncomePeriodRecord[]
                  const { net, fee } = calculateNetIncome(allData)
                  setNetIncome(net)
                  setEstGatewayFee(fee)
              }
          } catch (e) {
              console.error("Error calculating net income", e)
          } finally {
              setIsCalculatingNet(false)
          }
      }

      // Debounce the calculation to avoid spamming API on every keystroke
      const timer = setTimeout(() => {
          calcGlobal()
      }, 1000)

      return () => clearTimeout(timer)
  }, [totalRecords, feeConfig, startDate, endDate, serviceType, paymentMethod, ownerId, selectedGroup, debouncedSearch, sortColumn, sortDirection, calculateNetIncome]) // Recalculate when filters or fees change

  const handleSaveFees = async (newFees: FeeConfig) => {
      try {
          const res = await fetch('/api/integrations/mixradius/fees', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newFees)
          })
          if (res.ok) {
              setFeeConfig(newFees)
              toast.success('Konfigurasi fee tersimpan')
          } else {
              toast.error('Gagal menyimpan')
          }
      } catch (e) {
          console.error(e)
          toast.error('Terjadi kesalahan')
      }
  }

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
  }, [page, pageSize, debouncedSearch, sortColumn, sortDirection, startDate, endDate, serviceType, paymentMethod, ownerId, selectedGroup])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExport = async () => {
    try {
        toast.loading('Menyiapkan data export...', { id: 'export' })

        const params = new URLSearchParams({
            start: '0',
            length: '10000', // Fetch all for export
            search: debouncedSearch,
            sortBy: sortColumn,
            sortDir: sortDirection,
            fdate: startDate,
            tdate: endDate,
        })

        if (serviceType) params.append('stype', serviceType)
        if (paymentMethod) params.append('payment_method', paymentMethod)
        if (ownerId && ownerId !== 'all') params.append('owner_id', ownerId)
        if (selectedGroup && selectedGroup !== 'all') params.append('groupId', selectedGroup)

        const response = await fetch(`/api/integrations/mixradius/reports/period?${params}`)
        const result = await response.json()

        if (!result.success || !result.data?.data) {
            throw new Error('Gagal mengambil data untuk export')
        }

        const records = result.data.data as IncomePeriodRecord[]

        // Generate CSV
        const headers = ['Invoice', 'Pelanggan', 'Username', 'Paket', 'Total', 'Fee Seller', 'Status', 'Tanggal', 'Owner', 'Metode Bayar']
        const csvContent = [
            headers.join(','),
            ...records.map(r => [
                `"${r.invoice}"`,
                `"${r.fullname}"`,
                `"${r.username}"`,
                `"${r.plan_name}"`,
                `"${r.total}"`,
                `"${r.seller_fee}"`,
                `"${r.trx_status}"`,
                `"${r.renewed_on}"`,
                `"${r.owner_name}"`,
                `"${r.payment_method}"`
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute('download', `Laporan_Pendapatan_${startDate}_${endDate}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast.success('Export berhasil!', { id: 'export' })
    } catch (err) {
        toast.error('Gagal export data', { id: 'export' })
        console.error(err)
    }
  }

  const totalPages = Math.ceil(totalRecords / pageSize)

  const formatCurrency = (amount: string | number) => {
    const num = parseNumber(amount)
    if (isNaN(num)) return String(amount)

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

        <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFeeModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <HiOutlineCog className="w-5 h-5" />
              Config Fee
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <HiOutlineArrowPath className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Memuat...' : 'Refresh'}
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {loading && <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">PROFIT (IDR)</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{summary?.profit || '0'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {loading && <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10"><div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div></div>}
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">FEE SELLER (IDR)</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">{summary?.feeSeller || '0'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {isCalculatingNet && <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10"><div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div></div>}
          <div className="flex justify-between items-start">
             <p className="text-sm font-medium text-gray-500 dark:text-gray-400">FEE GATEWAY (EST)</p>
             <button onClick={() => setShowFeeModal(true)} className="text-gray-400 hover:text-blue-500"><HiOutlineCog className="w-4 h-4" /></button>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{formatCurrency(estGatewayFee)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {loading && <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>}
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">TOTAL + PPN (IDR)</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{summary?.totalPlusPpn || '0'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {loading && <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div></div>}
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">TOTAL TRANSAKSI</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{summary?.totalTransactions || totalRecords.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800">
          {isCalculatingNet && <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>}
          <div className="flex justify-between items-start">
             <p className="text-sm font-medium text-gray-500 dark:text-gray-400">PENDAPATAN BERSIH (EST)</p>
             <button onClick={() => setShowFeeModal(true)} className="text-gray-400 hover:text-blue-500"><HiOutlineCog className="w-4 h-4" /></button>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(netIncome)}</p>
          <div className="flex flex-col gap-0.5 mt-1">
             <p className="text-[10px] text-gray-400">Est. Potongan Gateway: <span className="text-red-400 font-medium">-{formatCurrency(estGatewayFee)}</span></p>
             <p className="text-[10px] text-gray-400">Setelah pot. Fee Seller & Gateway</p>
          </div>
        </div>
      </div>

      <FeeConfigurationModal
        isOpen={showFeeModal}
        onClose={() => setShowFeeModal(false)}
        currentFees={feeConfig}
        onSave={handleSaveFees}
        availableMethods={Array.from(new Set(data.map(d => d.payment_method || d.method))).filter(Boolean)}
      />

      {/* Filters & Search - Toolbar Style matching MixRadiusClient */}
      <div className="flex flex-col xl:flex-row gap-2">
        <div className="flex flex-wrap gap-2 items-center flex-1">
            {/* Date Range */}
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1">
                <span className="text-xs text-gray-500 font-medium">Periode:</span>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                        setStartDate(e.target.value)
                        setPage(0)
                    }}
                    className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
                />
                <span className="text-gray-400">-</span>
                <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                        setEndDate(e.target.value)
                        setPage(0)
                    }}
                    className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
                />
            </div>

            {/* Service Type */}
            <select
                value={serviceType}
                onChange={(e) => {
                    setServiceType(e.target.value)
                    setPage(0)
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
            >
                <option value="">Semua Layanan</option>
                <option value="PPP">PPP / PPPoE</option>
                <option value="HOTSPOT">Hotspot</option>
            </select>

            {/* Payment Method */}
            <select
                value={paymentMethod}
                onChange={(e) => {
                    setPaymentMethod(e.target.value)
                    setPage(0)
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[120px]"
            >
                <option value="">Semua Metode</option>
                <option value="manual">Manual</option>
                <option value="online">Online</option>
            </select>

            {/* Management Site (Group) Filter */}
            <select
                value={selectedGroup}
                onChange={(e) => {
                    setSelectedGroup(e.target.value)
                    setPage(0)
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
            >
                <option value="all">Semua Site</option>
                {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                        {group.name}
                    </option>
                ))}
            </select>

            {/* Owner Filter */}
            <select
                value={ownerId}
                onChange={(e) => {
                    setOwnerId(e.target.value)
                    setPage(0)
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
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
        <div className="relative w-full xl:w-64">
            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
                type="text"
                placeholder="Cari Invoice, User, Nama..."
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
                    <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">{item.invoice}</span>
                )
              },
              {
                key: 'member_id',
                header: 'ID Pelanggan',
                priority: 'secondary',
                sortable: true,
                render: (item) => {
                    let displayId = 'n/a';
                    const isMember = item.method === 'MEMBER';

                    if (item.member_id === '0') {
                        displayId = 'n/a';
                    } else if (isMember) {
                        displayId = item.member_id;
                    } else {
                        displayId = item.username;
                    }

                    return (
                        <span className={`text-sm ${isMember ? 'font-mono font-bold' : ''} text-gray-900 dark:text-white`}>
                            {displayId}
                        </span>
                    );
                }
              },
              {
                key: 'fullname',
                header: 'Nama',
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
                key: 'nasporttype',
                header: 'Tipe Service',
                priority: 'secondary',
                sortable: true,
                render: (item) => {
                    const isPrepaid = item.payment_type === 'PREPAID';
                    const typeLabel = isPrepaid ? 'PRE' : 'POST';
                    const typeClass = isPrepaid
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';

                    let serviceName = 'HOTSPOT';
                    if (item.nasporttype === 'Ethernet') serviceName = 'PPPOE';
                    else if (item.nasporttype === 'Virtual') serviceName = 'PPTP/L2TP';
                    else if (item.nasporttype === 'Async') serviceName = 'OVPN/SSTP';

                    return (
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${typeClass}`}>
                                {typeLabel}
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{serviceName}</span>
                        </div>
                    );
                }
              },
              {
                key: 'plan_name',
                header: 'Paket Langganan',
                priority: 'secondary',
                sortable: true
              },
              {
                key: 'total',
                header: 'Harga [ +PPN ]',
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
                header: 'Fee Seller',
                priority: 'tertiary',
                sortable: true,
                render: (item) => (
                    <span className="text-gray-500 dark:text-gray-400">
                        {parseInt(String(item.seller_fee)) > 0 ? formatCurrency(item.seller_fee) : '-'}
                    </span>
                )
              },
              {
                key: 'renewed_on',
                header: 'Tanggal Aktif',
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
                key: 'payment_method',
                header: 'Metode Bayar',
                priority: 'secondary',
                sortable: true,
                render: (item) => {
                   const method = item.payment_method || item.method || '-';
                   const isOnline = method.toLowerCase().includes('dtk') ||
                                    method.toLowerCase().includes('tripay') ||
                                    method.toLowerCase().includes('midtrans') ||
                                    method.toLowerCase().includes('xendit') ||
                                    item.payment_type?.toLowerCase() === 'online';

                   return (
                       <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                           isOnline
                           ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                           : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                       }`}>
                           {method}
                       </span>
                   )
                }
              },
              {
                key: 'owner_name',
                header: 'Owner Data',
                priority: 'tertiary',
                sortable: true,
                render: (item) => (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                        <HiOutlineUser className="w-4 h-4" />
                        {item.owner_name}
                    </div>
                )
              }
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
