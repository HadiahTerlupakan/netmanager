"use client"

import { useEffect, useState, useMemo } from 'react'

type Onu = {
  id: string
  oltId: string
  oltName: string
  name: string
  description: string
  pppoe: string
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  serialNumber: string
  actualType: string
}

type Summary = {
  good: { count: number; percentage: number; rxOlt: number; rxOnu: number }
  warning: { count: number; percentage: number; rxOlt: number; rxOnu: number }
  critical: { count: number; percentage: number; rxOlt: number; rxOnu: number }
  other: { count: number; percentage: number; los: number; na: number }
}

export default function AllOnuPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onus, setOnus] = useState<Onu[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total, setTotal] = useState(0)
  const [dataSource, setDataSource] = useState<'database' | 'snmp' | null>(null)
  // const [syncing, setSyncing] = useState(false) // Sync feature disabled

  // Filters
  const [selectedOlt, setSelectedOlt] = useState<string>('all')
  const [selectedCard, setSelectedCard] = useState<string>('all')
  const [selectedPort, setSelectedPort] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedSignal, setSelectedSignal] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    loadOnus()
  }, [])

  const loadOnus = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/olts/onus')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Gagal memuat data ONU' }))
        throw new Error(errorData.error || 'Gagal memuat data ONU')
      }
      const data = await res.json()
      setOnus(data.onus || [])
      setSummary(data.summary || null)
      setTotal(data.total || 0)
      setDataSource(data.source || null)
    } catch (e: any) {
      setError(e.message)
      setOnus([])
      setSummary(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Get unique values for filters
  const uniqueOlts = useMemo(() => {
    const olts = new Set(onus.map((onu) => onu.oltName))
    return Array.from(olts).sort()
  }, [onus])

  const uniqueCards = useMemo(() => {
    const cards = new Set(
      onus
        .map((onu) => {
          const match = onu.gponOnu.match(/^(\d+)\/\d+\/\d+:\d+$/)
          return match ? match[1] : null
        })
        .filter((c) => c !== null)
    )
    return Array.from(cards).sort((a, b) => parseInt(a) - parseInt(b))
  }, [onus])

  const uniquePorts = useMemo(() => {
    const ports = new Set(
      onus
        .map((onu) => {
          const match = onu.gponOnu.match(/^\d+\/(\d+)\/\d+:\d+$/)
          return match ? match[1] : null
        })
        .filter((p) => p !== null)
    )
    return Array.from(ports).sort((a, b) => parseInt(a) - parseInt(b))
  }, [onus])

  const uniqueTypes = useMemo(() => {
    const types = new Set(onus.map((onu) => onu.actualType).filter((t) => t))
    return Array.from(types).sort()
  }, [onus])

  // Helper untuk menghitung count per filter
  const getCardCount = (card: string) => {
    if (card === 'all') return onus.length
    return onus.filter((onu) => {
      const match = onu.gponOnu.match(/^(\d+)\/\d+\/\d+:\d+$/)
      return match && match[1] === card
    }).length
  }

  const getPortCount = (port: string) => {
    if (port === 'all') return onus.length
    return onus.filter((onu) => {
      const match = onu.gponOnu.match(/^\d+\/(\d+)\/\d+:\d+$/)
      return match && match[1] === port
    }).length
  }

  const getTypeCount = (type: string) => {
    if (type === 'all') return onus.length
    return onus.filter((onu) => onu.actualType === type).length
  }

  // Active filters untuk display
  const activeFilters = useMemo(() => {
    const filters: Array<{ key: string; label: string; value: string }> = []
    if (selectedOlt !== 'all') {
      filters.push({ key: 'olt', label: selectedOlt, value: selectedOlt })
    }
    if (selectedCard !== 'all') {
      filters.push({ key: 'card', label: `Card ${selectedCard}`, value: selectedCard })
    }
    if (selectedPort !== 'all') {
      filters.push({ key: 'port', label: `Port ${selectedPort}`, value: selectedPort })
    }
    if (selectedType !== 'all') {
      filters.push({ key: 'type', label: selectedType, value: selectedType })
    }
    if (selectedStatus !== 'all') {
      filters.push({ key: 'status', label: selectedStatus === 'online' ? 'Online' : selectedStatus === 'los' ? 'LOS' : 'DyingGasp', value: selectedStatus })
    }
    if (selectedSignal !== 'all') {
      filters.push({ key: 'signal', label: selectedSignal === 'good' ? 'Good Signal' : selectedSignal === 'warning' ? 'Warning Signal' : selectedSignal === 'critical' ? 'Critical Signal' : 'No Signal', value: selectedSignal })
    }
    return filters
  }, [selectedOlt, selectedCard, selectedPort, selectedType, selectedStatus, selectedSignal])

  // Filter and search
  const filteredOnus = useMemo(() => {
    let filtered = [...onus]

    // Filter by OLT
    if (selectedOlt !== 'all') {
      filtered = filtered.filter((onu) => onu.oltName === selectedOlt)
    }

    // Filter by Card
    if (selectedCard !== 'all') {
      filtered = filtered.filter((onu) => {
        const match = onu.gponOnu.match(/^(\d+)\/\d+\/\d+:\d+$/)
        return match && match[1] === selectedCard
      })
    }

    // Filter by Port
    if (selectedPort !== 'all') {
      filtered = filtered.filter((onu) => {
        const match = onu.gponOnu.match(/^\d+\/(\d+)\/\d+:\d+$/)
        return match && match[1] === selectedPort
      })
    }

    // Filter by Type
    if (selectedType !== 'all') {
      filtered = filtered.filter((onu) => onu.actualType === selectedType)
    }

    // Filter by Status
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'online') {
        filtered = filtered.filter((onu) => onu.status === 'Online')
      } else if (selectedStatus === 'dyinggasp') {
        filtered = filtered.filter((onu) => onu.status === 'DyingGasp')
      } else if (selectedStatus === 'los') {
        filtered = filtered.filter((onu) => onu.status === 'LOS')
      }
    }

    // Filter by Signal
    if (selectedSignal !== 'all') {
      filtered = filtered.filter((onu) => {
        const rxOlt = onu.rxOlt ? parseFloat(onu.rxOlt.replace(/[^\d.-]/g, '')) : null
        if (selectedSignal === 'good' && rxOlt !== null && rxOlt >= -26.0) return true
        if (selectedSignal === 'warning' && rxOlt !== null && rxOlt >= -28.0 && rxOlt < -26.0) return true
        if (selectedSignal === 'critical' && rxOlt !== null && rxOlt < -28.0) return true
        if (selectedSignal === 'other' && (rxOlt === null || onu.status === 'LOS' || onu.status === 'DyingGasp'))
          return true
        return false
      })
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (onu) =>
          onu.name.toLowerCase().includes(query) ||
          onu.description.toLowerCase().includes(query) ||
          onu.pppoe.toLowerCase().includes(query) ||
          onu.gponOnu.toLowerCase().includes(query) ||
          onu.serialNumber.toLowerCase().includes(query) ||
          onu.oltName.toLowerCase().includes(query)
      )
    }

    // Sort
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: any = a[sortColumn as keyof Onu]
        let bVal: any = b[sortColumn as keyof Onu]

        if (sortColumn === 'rxOlt' || sortColumn === 'rxOnu') {
          aVal = aVal ? parseFloat(aVal.replace(/[^\d.-]/g, '')) : -999
          bVal = bVal ? parseFloat(bVal.replace(/[^\d.-]/g, '')) : -999
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [onus, selectedOlt, selectedCard, selectedPort, selectedType, selectedStatus, selectedSignal, searchQuery, sortColumn, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredOnus.length / pageSize)
  const paginatedOnus = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredOnus.slice(start, start + pageSize)
  }, [filteredOnus, currentPage, pageSize])

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const getStatusIcon = (status: string) => {
    if (status === 'Online') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-sm text-gray-900 dark:text-white">Online</span>
        </span>
      )
    } else if (status === 'DyingGasp') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
          </div>
          <span className="text-sm text-gray-900 dark:text-white">DyingGasp</span>
        </span>
      )
    } else if (status === 'LOS') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-sm text-gray-900 dark:text-white">LOS</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5">
        <div className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 100 2 1 1 0 000-2zm0 4a1 1 0 100 2h.01a1 1 0 100-2H10zm-1 4a1 1 0 102 0 1 1 0 00-2 0z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="text-sm text-gray-900 dark:text-white">{status}</span>
      </span>
    )
  }

  const getSignalBar = (rx: string | null, type: 'olt' | 'onu') => {
    if (!rx) {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-end gap-0.5">
            <div className="w-1 h-2 border border-dashed border-gray-400 dark:border-gray-500 rounded-t"></div>
            <div className="w-1 h-2 border border-dashed border-gray-400 dark:border-gray-500 rounded-t"></div>
            <div className="w-1 h-2 border border-dashed border-gray-400 dark:border-gray-500 rounded-t"></div>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">N/A</span>
        </div>
      )
    }

    const value = parseFloat(rx.replace(/[^\d.-]/g, ''))
    let barColor = 'bg-red-600 dark:bg-red-400'
    let textColor = 'text-red-600 dark:text-red-400'
    let bars = [1, 0, 0] // 1 bar untuk critical
    
    if (value >= -26.0) {
      barColor = 'bg-green-600 dark:bg-green-400'
      textColor = 'text-green-600 dark:text-green-400'
      bars = [1, 1, 1] // 3 bars untuk good
    } else if (value >= -28.0) {
      barColor = 'bg-orange-600 dark:bg-orange-400'
      textColor = 'text-orange-600 dark:text-orange-400'
      bars = [1, 1, 0] // 2 bars untuk warning
    }

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-end gap-0.5">
          {bars.map((show, idx) => (
            <div
              key={idx}
              className={`w-1 ${show ? `${barColor} rounded-t` : 'bg-gray-300 dark:bg-gray-600 rounded-t'}`}
              style={{ height: `${3 + idx}px` }}
            ></div>
          ))}
        </div>
        <span className={`text-xs ${textColor}`}>
          {rx}
        </span>
      </div>
    )
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
        <span>Home</span> <span className="mx-2">/</span> <span className="text-gray-900 dark:text-white">All-ONUs</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">ONUs</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter Icon */}
          <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
          {/* Sync button disabled - fitur sync sementara dinonaktifkan */}
          {/* <button
            onClick={async () => {
              setSyncing(true)
              try {
                const res = await fetch('/api/olts/onus/sync', { method: 'POST' })
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({ error: 'Gagal sync data' }))
                  throw new Error(errorData.error || 'Gagal sync data')
                }
                const data = await res.json()
                alert(`Sync berhasil! ${data.message || `Berhasil sync ${data.count || 0} ONU`}`)
                // Reload data setelah sync
                await loadOnus()
              } catch (e: any) {
                alert(`Error: ${e.message}`)
              } finally {
                setSyncing(false)
              }
            }}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-60"
          >
            <svg
              className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {syncing ? 'Syncing...' : 'Sync Data'}
          </button> */}
          <button
            onClick={async () => {
              // Force refresh dari SNMP
              setRefreshing(true)
              try {
                const res = await fetch('/api/olts/onus?refresh=true')
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({ error: 'Gagal memuat data ONU' }))
                  throw new Error(errorData.error || 'Gagal memuat data ONU')
                }
                const data = await res.json()
                setOnus(data.onus || [])
                setSummary(data.summary || null)
                setTotal(data.total || 0)
                setDataSource(data.source || null)
              } catch (e: any) {
                setError(e.message)
                setOnus([])
                setSummary(null)
              } finally {
                setRefreshing(false)
              }
            }}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Good Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Good</div>
                <div className="text-xs text-green-600 dark:text-green-400 font-medium">≥ -26.00 dBm</div>
              </div>
              <div className="text-2xl">📊</div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {summary.good.percentage.toFixed(1)}%
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">RX OLT:</span>
                <span className="font-medium text-gray-900 dark:text-white">{summary.good.rxOlt}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">RX ONU:</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{
                        width: `${summary.good.rxOnu > 0 ? (summary.good.rxOnu / summary.good.rxOlt) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{summary.good.rxOnu}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Warning</div>
                <div className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">-26.00 ~ -28.00 dBm</div>
              </div>
              <div className="text-2xl">⚠️</div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {summary.warning.percentage.toFixed(1)}%
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">RX OLT:</span>
                <span className="font-medium text-gray-900 dark:text-white">{summary.warning.rxOlt}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">RX ONU:</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500"
                      style={{
                        width: `${
                          summary.warning.rxOnu > 0 ? (summary.warning.rxOnu / summary.warning.rxOlt) * 100 : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{summary.warning.rxOnu}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Critical Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Critical</div>
                <div className="text-xs text-red-600 dark:text-red-400 font-medium">&lt;-28.00 dBm</div>
              </div>
              <div className="text-2xl">🔴</div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {summary.critical.percentage.toFixed(1)}%
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">RX OLT:</span>
                <span className="font-medium text-gray-900 dark:text-white">{summary.critical.rxOlt}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">RX ONU:</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500"
                      style={{
                        width: `${
                          summary.critical.rxOnu > 0 ? (summary.critical.rxOnu / summary.critical.rxOlt) * 100 : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white">{summary.critical.rxOnu}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Other Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Other</div>
              </div>
              <div className="text-2xl">❌</div>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {summary.other.percentage.toFixed(1)}%
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">LOS:</span>
                <span className="font-medium text-gray-900 dark:text-white">{summary.other.los}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">N/A:</span>
                <span className="font-medium text-gray-900 dark:text-white">{summary.other.na}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONUs Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 border-indigo-500">
        {/* Filter Bar - Sesuai dengan gambar */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-3">
            {/* OLT Filter */}
            <div className="relative">
              <select
                value={selectedOlt}
                onChange={(e) => {
                  setSelectedOlt(e.target.value)
                  setCurrentPage(1)
                }}
                className="appearance-none pl-10 pr-8 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All OLTs</option>
                {uniqueOlts.map((olt) => (
                  <option key={olt} value={olt} className="bg-white text-gray-900">
                    {olt}
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Card Filter */}
            <div className="relative">
              <select
                value={selectedCard}
                onChange={(e) => {
                  setSelectedCard(e.target.value)
                  setCurrentPage(1)
                }}
                className="appearance-none pl-10 pr-8 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Cards</option>
                {uniqueCards.map((card) => (
                  <option key={card} value={card} className="bg-white text-gray-900">
                    Card {card} - GTGH ({getCardCount(card)})
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Port Filter */}
            <div className="relative">
              <select
                value={selectedPort}
                onChange={(e) => {
                  setSelectedPort(e.target.value)
                  setCurrentPage(1)
                }}
                className="appearance-none pl-10 pr-8 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Ports</option>
                {uniquePorts.map((port) => (
                  <option key={port} value={port} className="bg-white text-gray-900">
                    Port {port} ({getPortCount(port)})
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Type Filter */}
            <div className="relative">
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value)
                  setCurrentPage(1)
                }}
                className="appearance-none pl-10 pr-8 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                {uniqueTypes.map((type) => (
                  <option key={type} value={type} className="bg-white text-gray-900">
                    {type} ({getTypeCount(type)})
                  </option>
                ))}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Status Label and Filters */}
            <div className="flex items-center gap-2 ml-2">
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Status:</span>
              <button
                onClick={() => {
                  setSelectedStatus(selectedStatus === 'online' ? 'all' : 'online')
                  setCurrentPage(1)
                }}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                  selectedStatus === 'online'
                    ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Online"
              >
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setSelectedStatus(selectedStatus === 'dyinggasp' ? 'all' : 'dyinggasp')
                  setCurrentPage(1)
                }}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                  selectedStatus === 'dyinggasp'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Dying Gasp"
              >
                <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setSelectedStatus(selectedStatus === 'los' ? 'all' : 'los')
                  setCurrentPage(1)
                }}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                  selectedStatus === 'los'
                    ? 'bg-red-100 dark:bg-red-900/30 border-2 border-red-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="LOS"
              >
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setSelectedStatus(selectedStatus === 'authfailed' ? 'all' : 'authfailed')
                  setCurrentPage(1)
                }}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                  selectedStatus === 'authfailed'
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Auth Failed"
              >
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setSelectedStatus(selectedStatus === 'unknown' ? 'all' : 'unknown')
                  setCurrentPage(1)
                }}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                  selectedStatus === 'unknown'
                    ? 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Unknown"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 100 2 1 1 0 000-2zm0 4a1 1 0 100 2h.01a1 1 0 100-2H10zm-1 4a1 1 0 102 0 1 1 0 00-2 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Signal Label and Filters */}
            <div className="flex items-center gap-2 ml-2">
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Signal:</span>
              <button
                onClick={() => {
                  setSelectedSignal(selectedSignal === 'good' ? 'all' : 'good')
                  setCurrentPage(1)
                }}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                  selectedSignal === 'good'
                    ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Good Signal (≥ -26 dBm)"
              >
                <div className="flex items-end gap-0.5">
                  <div className="w-1 h-3 bg-green-600 dark:bg-green-400 rounded-t"></div>
                  <div className="w-1 h-4 bg-green-600 dark:bg-green-400 rounded-t"></div>
                  <div className="w-1 h-5 bg-green-600 dark:bg-green-400 rounded-t"></div>
                </div>
              </button>
              <button
                onClick={() => {
                  setSelectedSignal(selectedSignal === 'warning' ? 'all' : 'warning')
                  setCurrentPage(1)
                }}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                  selectedSignal === 'warning'
                    ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Warning Signal (-26 to -28 dBm)"
              >
                <div className="flex items-end gap-0.5">
                  <div className="w-1 h-3 bg-orange-600 dark:bg-orange-400 rounded-t"></div>
                  <div className="w-1 h-4 bg-orange-600 dark:bg-orange-400 rounded-t"></div>
                  <div className="w-1 h-2 bg-gray-300 dark:bg-gray-600 rounded-t"></div>
                </div>
              </button>
              <button
                onClick={() => {
                  setSelectedSignal(selectedSignal === 'critical' ? 'all' : 'critical')
                  setCurrentPage(1)
                }}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                  selectedSignal === 'critical'
                    ? 'bg-red-100 dark:bg-red-900/30 border-2 border-red-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="Critical Signal (< -28 dBm)"
              >
                <div className="flex items-end gap-0.5">
                  <div className="w-1 h-3 bg-red-600 dark:bg-red-400 rounded-t"></div>
                  <div className="w-1 h-2 bg-gray-300 dark:bg-gray-600 rounded-t"></div>
                  <div className="w-1 h-2 bg-gray-300 dark:bg-gray-600 rounded-t"></div>
                </div>
              </button>
              <button
                onClick={() => {
                  setSelectedSignal(selectedSignal === 'other' ? 'all' : 'other')
                  setCurrentPage(1)
                }}
                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                  selectedSignal === 'other'
                    ? 'bg-gray-100 dark:bg-gray-700 border-2 border-gray-500'
                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                title="No Signal / N/A"
              >
                <div className="flex items-end gap-0.5">
                  <div className="w-1 h-2 border border-dashed border-gray-400 dark:border-gray-500 rounded-t"></div>
                  <div className="w-1 h-2 border border-dashed border-gray-400 dark:border-gray-500 rounded-t"></div>
                  <div className="w-1 h-2 border border-dashed border-gray-400 dark:border-gray-500 rounded-t"></div>
                </div>
              </button>
            </div>

            {/* Export Button */}
            <button className="ml-auto px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>

            {/* Reset Filter Button */}
            <button
              onClick={() => {
                setSelectedOlt('all')
                setSelectedCard('all')
                setSelectedPort('all')
                setSelectedType('all')
                setSelectedStatus('all')
                setSelectedSignal('all')
                setSearchQuery('')
                setCurrentPage(1)
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Filter
            </button>
          </div>

          {/* Active Filters Display */}
          {activeFilters.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Active Filter:</span>
              {activeFilters.map((filter) => (
                <span
                  key={filter.key}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-sm font-medium"
                >
                  <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                  {filter.label}
                  <button
                    onClick={() => {
                      if (filter.key === 'olt') setSelectedOlt('all')
                      else if (filter.key === 'card') setSelectedCard('all')
                      else if (filter.key === 'port') setSelectedPort('all')
                      else if (filter.key === 'type') setSelectedType('all')
                      else if (filter.key === 'status') setSelectedStatus('all')
                      else if (filter.key === 'signal') setSelectedSignal('all')
                      setCurrentPage(1)
                    }}
                    className="ml-1 hover:text-indigo-900 dark:hover:text-indigo-300"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search Bar */}
          <div className="mt-3 flex items-center justify-end gap-2">
            <label className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Search:</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search ONU..."
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {/* Pagination Control - di atas table */}
          <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600 dark:text-gray-400">entries</span>
            </div>
          </div>

          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" className="rounded border-gray-300" />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('oltName')}
                >
                  <div className="flex items-center gap-1">
                    OLT
                    {sortColumn === 'oltName' && (
                      <svg
                        className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Name
                    {sortColumn === 'name' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center gap-1">
                    Description
                    {sortColumn === 'description' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('pppoe')}
                >
                  <div className="flex items-center gap-1">
                    PPPoE
                    {sortColumn === 'pppoe' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('gponOnu')}
                >
                  <div className="flex items-center gap-1">
                    Gpon Onu
                    {sortColumn === 'gponOnu' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortColumn === 'status' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('rxOlt')}
                >
                  <div className="flex items-center gap-1">
                    RX OLT
                    {sortColumn === 'rxOlt' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('rxOnu')}
                >
                  <div className="flex items-center gap-1">
                    RX ONU
                    {sortColumn === 'rxOnu' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('serialNumber')}
                >
                  <div className="flex items-center gap-1">
                    Serial Number
                    {sortColumn === 'serialNumber' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('actualType')}
                >
                  <div className="flex items-center gap-1">
                    Actual Type
                    {sortColumn === 'actualType' && (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {paginatedOnus.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada data ONU ditemukan
                  </td>
                </tr>
              ) : (
                paginatedOnus.map((onu) => (
                  <tr key={onu.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{onu.oltName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{onu.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{onu.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{onu.pppoe || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-medium">{onu.gponOnu}</td>
                    <td className="px-4 py-3 text-sm">{getStatusIcon(onu.status)}</td>
                    <td className="px-4 py-3">{getSignalBar(onu.rxOlt, 'olt')}</td>
                    <td className="px-4 py-3">{getSignalBar(onu.rxOnu, 'onu')}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{onu.serialNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{onu.actualType}</td>
                    <td className="px-4 py-3">
                      <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Setting
                      </button>
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
            Showing {filteredOnus.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredOnus.length)} of {filteredOnus.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Sebelumnya
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 text-sm border rounded ${
                    currentPage === pageNum
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span className="text-gray-500">...</span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {totalPages}
                </button>
              </>
            )}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Selanjutnya →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

