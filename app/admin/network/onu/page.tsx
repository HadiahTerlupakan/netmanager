"use client"

import { useEffect, useState, useMemo } from 'react'
import { HiCheck, HiArrowTopRightOnSquare, HiXMark, HiQuestionMarkCircle, HiOutlineChartBar, HiOutlineFunnel, HiArrowPath, HiOutlineCpuChip, HiChevronDown, HiOutlineGlobeAlt, HiOutlineWifi, HiOutlineViewColumns, HiDocumentArrowDown, HiArrowPath as HiRefresh, HiXMark as HiClose, HiExclamationTriangle, HiCheckCircle, HiArrowPath as HiArrowPathIcon, HiXCircle, HiExclamationCircle, HiCog6Tooth, HiChevronUpDown, HiCircleStack, HiSignal, HiSignalSlash } from 'react-icons/hi2'

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

type OLT = {
  id: string
  name: string
  ipAddress: string
}

type Card = {
  frame: number
  card: number
  slots: Array<{
    slot: number
    ports: number[]
  }>
  totalSlots: number
  totalPorts: number
}

export default function AllOnuPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onus, setOnus] = useState<Onu[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [total, setTotal] = useState(0)
  const [dataSource, setDataSource] = useState<'database' | 'snmp' | null>(null)
  const [allOlts, setAllOlts] = useState<OLT[]>([])
  const [allCards, setAllCards] = useState<Card[]>([])
  const [loadingCards, setLoadingCards] = useState(false)
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
    loadAllOlts()
  }, [])

  // Load cards saat OLT dipilih atau saat semua OLT dimuat
  useEffect(() => {
    if (allOlts.length > 0) {
      loadAllCards()
    }
  }, [allOlts, selectedOlt])

  const loadAllOlts = async () => {
    try {
      const res = await fetch('/api/olts')
      if (!res.ok) {
        console.error('Gagal memuat data OLT')
        return
      }
      const data = await res.json()
      setAllOlts(data.olts || [])
    } catch (e: any) {
      console.error('Error loading OLTs:', e)
    }
  }

  const loadAllCards = async () => {
    setLoadingCards(true)
    try {
      const cards: Card[] = []
      
      // Jika OLT tertentu dipilih, load cards dari OLT tersebut saja
      if (selectedOlt !== 'all') {
        const olt = allOlts.find((o) => o.name === selectedOlt)
        if (olt) {
          try {
            const res = await fetch(`/api/olts/${olt.id}/cards`)
            if (res.ok) {
              const data = await res.json()
              if (data.success && data.cards) {
                cards.push(...data.cards)
              }
            }
          } catch (e) {
            console.error(`Error loading cards for OLT ${olt.name}:`, e)
          }
        }
      } else {
        // Load cards dari semua OLT yang terhubung SNMP
        for (const olt of allOlts) {
          try {
            const res = await fetch(`/api/olts/${olt.id}/cards`)
            if (res.ok) {
              const data = await res.json()
              if (data.success && data.cards) {
                cards.push(...data.cards)
              }
            }
          } catch (e) {
            // Skip OLT yang tidak bisa diakses atau tidak terhubung SNMP
            console.error(`Error loading cards for OLT ${olt.name}:`, e)
          }
        }
      }
      
      // Remove duplicate cards (same frame number)
      const uniqueCardsMap = new Map<number, Card>()
      for (const card of cards) {
        if (!uniqueCardsMap.has(card.frame)) {
          uniqueCardsMap.set(card.frame, card)
        }
      }
      
      setAllCards(Array.from(uniqueCardsMap.values()).sort((a, b) => a.frame - b.frame))
    } catch (e: any) {
      console.error('Error loading cards:', e)
    } finally {
      setLoadingCards(false)
    }
  }

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
  // Menggunakan semua OLT dari database, bukan hanya dari ONU yang ada
  const uniqueOlts = useMemo(() => {
    return allOlts.map((olt) => olt.name).sort()
  }, [allOlts])

  // Get cards dari SNMP atau fallback ke ONU data
  const uniqueCards = useMemo(() => {
    // Prioritaskan cards dari SNMP
    if (allCards.length > 0) {
      return allCards.map((card) => card.frame.toString()).sort((a, b) => parseInt(a) - parseInt(b))
    }
    
    // Fallback: ambil dari ONU data jika ada
    const cards = new Set(
      onus
        .map((onu) => {
          const match = onu.gponOnu.match(/^(\d+)\/\d+\/\d+:\d+$/)
          return match ? match[1] : null
        })
        .filter((c) => c !== null)
    )
    return Array.from(cards).sort((a, b) => parseInt(a) - parseInt(b))
  }, [allCards, onus])

  // Get PON ports dari SNMP (cards) atau fallback ke ONU data
  // Format: Card/Slot/PON, jadi PON adalah bagian ketiga
  const uniquePorts = useMemo(() => {
    // Prioritaskan PON ports dari SNMP cards
    if (allCards.length > 0) {
      const ponPorts = new Set<number>()
      
      // Ambil semua PON ports dari semua slots di semua cards
      // slot.ports adalah PON ports
      for (const card of allCards) {
        for (const slot of card.slots) {
          for (const ponPort of slot.ports) {
            ponPorts.add(ponPort)
          }
        }
      }
      
      return Array.from(ponPorts)
        .sort((a, b) => a - b)
        .map((p) => p.toString())
    }
    
    // Fallback: ambil PON port dari ONU data jika ada
    // Format gponOnu: Frame/Slot/PON:ONU_ID
    // Jadi PON adalah bagian ketiga sebelum :
    const ponPorts = new Set(
      onus
        .map((onu) => {
          // Format: 1/9/1:1 -> ambil bagian ketiga (PON)
          const match = onu.gponOnu.match(/^\d+\/\d+\/(\d+):\d+$/)
          return match ? match[1] : null
        })
        .filter((p) => p !== null)
    )
    return Array.from(ponPorts).sort((a, b) => parseInt(a) - parseInt(b))
  }, [allCards, onus])

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
    
    const ponPortNum = parseInt(port)
    if (isNaN(ponPortNum)) return 0
    
    // Jika ada data cards dari SNMP, hitung berapa banyak slot yang memiliki PON port ini
    if (allCards.length > 0) {
      let slotCount = 0
      for (const card of allCards) {
        for (const slot of card.slots) {
          // slot.ports adalah PON ports
          if (slot.ports.includes(ponPortNum)) {
            slotCount++
          }
        }
      }
      return slotCount
    }
    
    // Fallback: hitung dari ONU data (berapa banyak ONU yang menggunakan PON port ini)
    // Format: Frame/Slot/PON:ONU_ID, jadi PON adalah bagian ketiga
    return onus.filter((onu) => {
      const match = onu.gponOnu.match(/^\d+\/\d+\/(\d+):\d+$/)
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
      filters.push({ key: 'port', label: `PON ${selectedPort}`, value: selectedPort })
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

    // Filter by PON Port
    // Format: Frame/Slot/PON:ONU_ID, jadi PON adalah bagian ketiga
    if (selectedPort !== 'all') {
      filtered = filtered.filter((onu) => {
        // Format: 1/9/1:1 -> ambil bagian ketiga (PON)
        const match = onu.gponOnu.match(/^\d+\/\d+\/(\d+):\d+$/)
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
            <HiCheck className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="text-sm text-gray-900 dark:text-white">Online</span>
        </span>
      )
    } else if (status === 'DyingGasp') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
            <HiArrowTopRightOnSquare className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="text-sm text-gray-900 dark:text-white">DyingGasp</span>
        </span>
      )
    } else if (status === 'LOS') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <HiXMark className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="text-sm text-gray-900 dark:text-white">LOS</span>
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5">
        <div className="w-4 h-4 rounded-full bg-gray-400 flex items-center justify-center">
          <HiQuestionMarkCircle className="w-2.5 h-2.5 text-white" />
        </div>
        <span className="text-sm text-gray-900 dark:text-white">{status}</span>
      </span>
    )
  }

  const getSignalBar = (rx: string | null, type: 'olt' | 'onu') => {
    if (!rx) {
      return (
        <div className="flex items-center gap-2">
          <HiSignalSlash className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">N/A</span>
        </div>
      )
    }

    const value = parseFloat(rx.replace(/[^\d.-]/g, ''))
    let iconColor = 'text-red-600 dark:text-red-400'
    let textColor = 'text-red-600 dark:text-red-400'
    
    if (value >= -26.0) {
      iconColor = 'text-green-600 dark:text-green-400'
      textColor = 'text-green-600 dark:text-green-400'
    } else if (value >= -28.0) {
      iconColor = 'text-orange-600 dark:text-orange-400'
      textColor = 'text-orange-600 dark:text-orange-400'
    }

    return (
      <div className="flex items-center gap-2">
        <HiSignal className={`w-4 h-4 ${iconColor}`} />
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
          <HiArrowPath className="mb-4 w-12 h-12 animate-spin text-gray-400" />
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
            <HiOutlineFunnel className="w-5 h-5" />
          </button>
          {/* Sync button disabled - fitur sync sementara dinonaktifkan */}
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
            <HiArrowPath className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
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
              <HiOutlineChartBar className="text-2xl" />
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
              <HiExclamationTriangle className="w-8 h-8 text-yellow-500" />
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
              <HiXCircle className="w-8 h-8 text-red-500" />
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
              <HiXMark className="w-8 h-8 text-gray-500" />
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
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
                <HiOutlineViewColumns className="w-4 h-4 text-white" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <HiChevronDown className="w-4 h-4 text-white" />
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
                disabled={loadingCards}
                className="appearance-none pl-10 pr-8 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">
                  {loadingCards ? 'Loading Cards...' : uniqueCards.length === 0 ? 'No Cards Available' : 'All Cards'}
                </option>
                {uniqueCards.map((card) => {
                  const cardData = allCards.find((c) => c.frame.toString() === card)
                  const portCount = cardData ? cardData.totalPorts : getCardCount(card)
                  return (
                    <option key={card} value={card} className="bg-white text-gray-900">
                      Card {card} - GTGH ({portCount} ports)
                    </option>
                  )
                })}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <HiOutlineCpuChip className="w-4 h-4 text-white" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                {loadingCards ? (
                  <HiArrowPath className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <HiChevronDown className="w-4 h-4 text-white" />
                )}
              </div>
            </div>

            {/* PON Port Filter */}
            <div className="relative">
              <select
                value={selectedPort}
                onChange={(e) => {
                  setSelectedPort(e.target.value)
                  setCurrentPage(1)
                }}
                disabled={loadingCards}
                className="appearance-none pl-10 pr-8 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="all">
                  {loadingCards ? 'Loading PON Ports...' : uniquePorts.length === 0 ? 'No PON Ports Available' : 'All PON Ports'}
                </option>
                {uniquePorts.map((ponPort) => {
                  const slotCount = getPortCount(ponPort)
                  return (
                    <option key={ponPort} value={ponPort} className="bg-white text-gray-900">
                      PON {ponPort} ({slotCount} {slotCount === 1 ? 'slot' : 'slots'})
                    </option>
                  )
                })}
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <HiOutlineGlobeAlt className="w-4 h-4 text-white" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                {loadingCards ? (
                  <HiArrowPath className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <HiChevronDown className="w-4 h-4 text-white" />
                )}
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
                <HiOutlineWifi className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                <HiChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-400" />
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
                <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
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
                <HiArrowTopRightOnSquare className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
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
                <HiXCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
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
                <HiExclamationCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
                <HiQuestionMarkCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
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
                <HiSignal className="w-5 h-5 text-green-600 dark:text-green-400" />
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
                <HiSignal className="w-5 h-5 text-orange-600 dark:text-orange-400" />
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
                <HiSignal className="w-5 h-5 text-red-600 dark:text-red-400" />
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
                <HiSignalSlash className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </button>
            </div>

            {/* Export Button */}
            <button className="ml-auto px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
              <HiDocumentArrowDown className="w-4 h-4" />
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
              <HiRefresh className="w-4 h-4" />
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
                    <HiXMark className="w-3 h-3" />
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
                      <HiChevronUpDown className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
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
                      <HiChevronUpDown className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
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
                      <HiChevronUpDown className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
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
                      <HiChevronUpDown className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
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
                      <HiChevronUpDown className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
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
                      <HiChevronUpDown className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
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
                      <HiChevronUpDown className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
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
                      <HiChevronUpDown className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
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
                      <HiChevronUpDown className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
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
                      <HiChevronUpDown className={`w-3 h-3 ${sortDirection === 'asc' ? '' : 'rotate-180'}`} />
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
                        <HiCog6Tooth className="w-3 h-3" />
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

