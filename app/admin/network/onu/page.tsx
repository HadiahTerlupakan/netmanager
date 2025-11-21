"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  HiCheckCircle, 
  HiExclamationTriangle, 
  HiBolt,
  HiInformationCircle,
  HiQuestionMarkCircle,
  HiOutlineTableCells,
  HiChevronDown,
  HiArrowDownTray,
  HiCog6Tooth,
  HiBars3,
  HiOutlineCreditCard,
  HiOutlineRectangleStack,
  HiOutlineCog6Tooth,
  HiArrowPath,
  HiXMark,
  HiCheck,
  HiMagnifyingGlass,
  HiSignal
} from 'react-icons/hi2'

type OnuData = {
  id: string
  oltId: string
  oltName: string
  name: string
  description: string | null
  pppoe: string | null
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  serialNumber: string | null
  actualType: string | null
}

type SummaryData = {
  total: number
  good: { count: number; percentage: string; rxOlt: number; rxOnu: number }
  warning: { count: number; percentage: string; rxOlt: number; rxOnu: number }
  critical: { count: number; percentage: string; rxOlt: number; rxOnu: number }
  other: { count: number; percentage: string; los: number; na: number }
}

type OLT = {
  id: string
  name: string
  ipAddress: string
  type?: string // OLT type (e.g., ZTE-C300)
  snmpConnected: boolean
  snmpCommunityWrite: string | null
  snmpPort?: number
  snmpVersion?: string
}

type Card = {
  frame: number
  card: number
  slots: Array<{ slot: number; ports: number[] }>
  totalSlots: number
  totalPorts: number
}

const DEFAULT_LIMIT = 5
const ROW_HEIGHT = 68
const GRID_TEMPLATE_COLUMNS = '60px 170px 220px 240px 150px 140px 140px 140px 150px 200px 160px 120px'

const INITIAL_SUMMARY: SummaryData = {
  total: 0,
  good: { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 },
  warning: { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 },
  critical: { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 },
  other: { count: 0, percentage: '0', los: 0, na: 0 },
}

const INITIAL_PAGINATION = {
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 0,
}

export default function AllOnuPage() {
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [onus, setOnus] = useState<OnuData[]>([])
  const [allOnus, setAllOnus] = useState<OnuData[]>([])
  const [summaryData, setSummaryData] = useState<SummaryData>(INITIAL_SUMMARY)
  const [pagination, setPagination] = useState({ ...INITIAL_PAGINATION })
  const [nextCursor, setNextCursor] = useState<number | null>(0)
  const [page, setPage] = useState(1)

  const [selectedOlt, setSelectedOlt] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [selectedPort, setSelectedPort] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)

  const [olts, setOlts] = useState<OLT[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [globalCards, setGlobalCards] = useState<Card[]>([])
  const [ports, setPorts] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({})
  const [typeSearch, setTypeSearch] = useState('')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRefs = {
    olt: useRef<HTMLDivElement>(null),
    card: useRef<HTMLDivElement>(null),
    port: useRef<HTMLDivElement>(null),
    type: useRef<HTMLDivElement>(null),
  }
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const searchRef = useRef(search)
  const hasCardOptions = cards.length > 0

  const fetchOlts = async () => {
    try {
      const res = await fetch('/api/olts')
      const data = await res.json()
      if (data.olts) {
        const connectedOlts = data.olts
          .filter((olt: any) => olt.snmpConnected && olt.snmpCommunityWrite && olt.type?.toLowerCase().includes('c300'))
          .map((olt: any) => ({
            id: olt.id,
            name: olt.name,
            ipAddress: olt.ipAddress,
            type: olt.type,
            snmpConnected: olt.snmpConnected,
            snmpCommunityWrite: olt.snmpCommunityWrite,
            snmpPort: olt.snmpPort,
            snmpVersion: olt.snmpVersion,
          }))
        setOlts(connectedOlts)
      }
    } catch (error) {
      console.error('Error fetching OLTs:', error)
    }
  }

  const fetchCards = async (oltId: string) => {
    try {
      const res = await fetch(`/api/olts/${oltId}/cards`)
      const data = await res.json()
      if (data.cards) {
        setCards(data.cards)
      } else {
        setCards([])
      }
    } catch (error) {
      console.error('Error fetching Cards:', error)
      setCards([])
    }
  }

  const extractPorts = (selectedCardStr: string) => {
    if (!selectedCardStr) return []
    
    const [frame, slot] = selectedCardStr.split('/').map(Number)
    const card = cards.find(c => c.frame === frame)
    if (!card) return []
    
    const slotData = card.slots.find(s => s.slot === slot)
    if (!slotData) return []
    
    return slotData.ports.map(p => `${frame}/${slot}/${p}`)
  }

  const extractTypesAndCounts = (onusData: OnuData[] = allOnus) => {
    const typeMap = new Map<string, number>()
    onusData.forEach(onu => {
      if (onu.actualType) {
        const count = typeMap.get(onu.actualType) || 0
        typeMap.set(onu.actualType, count + 1)
      }
    })
    
    const typesArray = Array.from(typeMap.keys()).sort()
    const countsObj: Record<string, number> = {}
    typeMap.forEach((count, type) => {
      countsObj[type] = count
    })
    
    return { types: typesArray, counts: countsObj }
  }

  type FetchOptions = {
    reset?: boolean
    cursorOverride?: number
    searchValue?: string
  }

  const fetchOnus = useCallback(async (options: FetchOptions = {}) => {
    const { reset = false, cursorOverride, searchValue } = options
    const appliedSearch = searchValue ?? searchRef.current ?? ''
    
    // Untuk pagination, selalu gunakan cursor dari page
    const calculatedCursor = (page - 1) * limit
    const targetCursor = cursorOverride !== undefined && cursorOverride !== null
      ? cursorOverride
      : calculatedCursor

    if (targetCursor < 0 || isNaN(targetCursor)) {
      return
    }

    if (reset) {
      setLoading(true)
      setOnus([])
    }

    let loadingCleared = false

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        cursor: targetCursor.toString(),
      })
      if (appliedSearch.trim()) params.append('search', appliedSearch.trim())
      if (selectedOlt) params.append('oltId', selectedOlt)
      if (selectedCard) params.append('card', selectedCard)
      if (selectedPort) params.append('port', selectedPort)
      if (selectedType) params.append('type', selectedType)
      if (reset) params.append('forceRefresh', 'true')

      const res = await fetch(`/api/onus?${params.toString()}`)
      const data = await res.json()

      if (data.fromCache && reset) {
        setLoading(false)
        loadingCleared = true
      }

      if (data.error) {
        console.error('Error from API:', data.error)
        if (data.error && data.error !== 'Gagal mengambil data ONU') {
          alert(`Error: ${data.error}`)
        }
        setOnus([])
        setSummaryData(data.summary || INITIAL_SUMMARY)
        setPagination(data.pagination || { ...INITIAL_PAGINATION, limit })
        setNextCursor(null)
        return
      }

      const incomingOnus: OnuData[] = data.onus || []
      // Always replace data, jangan append
      setOnus(incomingOnus)
      setSummaryData(data.summary || INITIAL_SUMMARY)
      setPagination(data.pagination || { ...INITIAL_PAGINATION, limit })
      // Update nextCursor untuk tracking, tapi untuk pagination kita gunakan page-based
      setNextCursor(data.nextCursor ?? null)

      if (data.types && data.typeCounts) {
        setTypes(data.types)
        setTypeCounts(data.typeCounts)
        if (data.totalOnus !== undefined) {
          setAllOnus(Array(data.totalOnus).fill(null))
        }
      }

      if (!selectedOlt && data.cards) {
        setGlobalCards(data.cards)
        setCards(data.cards)
      }
    } catch (error: any) {
      console.error('Error fetching ONUs:', error)
      if (reset) {
        setOnus([])
      }
      setTypes([])
      setTypeCounts({})
      setNextCursor(null)
    } finally {
      if (reset && !loadingCleared) {
        setLoading(false)
      }
    }
  }, [limit, page, selectedCard, selectedOlt, selectedPort, selectedType])

  const calculateSummary = (onus: OnuData[]): SummaryData => {
    const total = onus.length
    let good = { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 }
    let warning = { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 }
    let critical = { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 }
    let other = { count: 0, percentage: '0', los: 0, na: 0 }

    onus.forEach(onu => {
      const rxOlt = onu.rxOlt ? parseFloat(onu.rxOlt.replace(/[^\d.-]/g, '')) : null
      const rxOnu = onu.rxOnu ? parseFloat(onu.rxOnu.replace(/[^\d.-]/g, '')) : null

      if (onu.status === 'Online' && rxOlt !== null && rxOlt > -30 && rxOnu !== null && rxOnu > -40) {
        good.count++
        good.rxOlt++
        good.rxOnu++
      } else if (onu.status === 'Online' && ((rxOlt !== null && rxOlt >= -28) || (rxOnu !== null && rxOnu >= -35))) {
        warning.count++
        warning.rxOlt++
        warning.rxOnu++
      } else if (onu.status === 'LOS' || (rxOlt !== null && rxOlt <= -35) || (rxOnu !== null && rxOnu <= -45)) {
        critical.count++
        critical.rxOlt++
        critical.rxOnu++
      } else {
        other.count++
        if (onu.status === 'LOS') other.los++
        else other.na++
      }
    })

    good.percentage = total > 0 ? ((good.count / total) * 100).toFixed(1) : '0'
    warning.percentage = total > 0 ? ((warning.count / total) * 100).toFixed(1) : '0'
    critical.percentage = total > 0 ? ((critical.count / total) * 100).toFixed(1) : '0'
    other.percentage = total > 0 ? ((other.count / total) * 100).toFixed(1) : '0'

    return {
      total,
      good,
      warning,
      critical,
      other
    }
  }

  const updateTypesFromOnus = (onus: OnuData[]) => {
    const typeMap = new Map<string, number>()
    onus.forEach(onu => {
      if (onu.actualType) {
        typeMap.set(onu.actualType, (typeMap.get(onu.actualType) || 0) + 1)
      }
    })

    const newTypes = Array.from(typeMap.keys()).sort()
    const newTypeCounts = Object.fromEntries(typeMap)

    setTypes(newTypes)
    setTypeCounts(newTypeCounts)
  }

  const fetchTypes = async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '10', // Minimal data, hanya butuh types dari response
      })
      const res = await fetch(`/api/onus?${params.toString()}`)
      const data = await res.json()
      
      if (!data.error && data.types && data.typeCounts) {
        setTypes(data.types)
        setTypeCounts(data.typeCounts)
        // Store total count untuk "All Types" badge
        if (data.totalOnus !== undefined) {
          // Use a simple number instead of array
          setAllOnus(Array(data.totalOnus).fill(null) as any)
        }
      }
    } catch (error) {
      console.error('Error fetching types:', error)
    }
  }

  useEffect(() => {
    searchRef.current = search
  }, [search])

  const handleRefresh = async () => {
    setNextCursor(0)
    try {
      await fetchOnus({ reset: true, cursorOverride: 0, searchValue: searchRef.current ?? '' })
    } catch (error: any) {
      console.error('Error refreshing ONUs:', error)
      alert('Terjadi kesalahan saat refresh: ' + (error.message || 'Unknown error'))
    }
  }

  useEffect(() => {
    fetchOlts()
    fetchTypes()
  }, [])
  useEffect(() => {
    if (olts.length > 0 && !selectedOlt) {
      fetchOnus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [olts.length])

  useEffect(() => {
    setSelectedCard(null)
    setSelectedPort(null)
    setPorts([])
    if (selectedOlt) {
      fetchCards(selectedOlt)
    }
  }, [selectedOlt])

  useEffect(() => {
    if (!selectedOlt) {
      setCards(globalCards)
    }
  }, [globalCards, selectedOlt])

  useEffect(() => {
    if (selectedCard && cards.length > 0) {
      const extractedPorts = extractPorts(selectedCard)
      setPorts(extractedPorts)
      setSelectedPort(null)
    } else {
      setPorts([])
      setSelectedPort(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCard, cards])

  useEffect(() => {
    setPage(1)
    setNextCursor(0)
    setOnus([])
  }, [selectedOlt, selectedCard, selectedPort, selectedType])

  useEffect(() => {
    if (olts.length > 0) {
      const cursorForPage = (page - 1) * limit
      // Clear data dan set loading sebelum fetch
      setOnus([])
      setLoading(true)
      setNextCursor(cursorForPage)
      fetchOnus({ reset: true, cursorOverride: cursorForPage })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, selectedOlt, selectedCard, selectedPort, selectedType])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setNextCursor(0)
      setOnus([])
      fetchOnus({ reset: true, cursorOverride: 0 })
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openDropdown &&
        dropdownRefs[openDropdown as keyof typeof dropdownRefs]?.current &&
        !dropdownRefs[openDropdown as keyof typeof dropdownRefs].current?.contains(event.target as Node)
      ) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDropdown])


  const getSignalColor = (rxOlt: string | null) => {
    if (!rxOlt || rxOlt === 'N/A') return 'text-gray-500'
    const value = parseFloat(rxOlt.replace(/[^\d.-]/g, ''))
    if (value >= -26.0) return 'text-green-600'
    if (value >= -28.0) return 'text-orange-600'
    return 'text-red-600'
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'online':
        return <HiCheckCircle className="w-5 h-5 text-green-600" />
      case 'warning':
        return <HiExclamationTriangle className="w-5 h-5 text-yellow-600" />
      case 'los':
      case 'critical':
        return <HiBolt className="w-5 h-5 text-red-600" />
      case 'info':
        return <HiInformationCircle className="w-5 h-5 text-blue-600" />
      default:
        return <HiQuestionMarkCircle className="w-5 h-5 text-gray-600" />
    }
  }

  const getSignalBars = (rxOlt: string | null) => {
    if (!rxOlt || rxOlt === 'N/A') return [false, false, false, false]
    const value = parseFloat(rxOlt.replace(/[^\d.-]/g, ''))
    if (value >= -26.0) return [true, true, true, true]
    if (value >= -27.0) return [true, true, true, false]
    if (value >= -28.0) return [true, true, false, false]
    return [true, false, false, false]
  }

  const SignalBars = ({ rxOlt, className = "" }: { rxOlt: string | null; className?: string }) => {
    const bars = getSignalBars(rxOlt)
    const getColor = () => {
      if (!rxOlt || rxOlt === 'N/A') return 'bg-gray-400'
      const value = parseFloat(rxOlt.replace(/[^\d.-]/g, ''))
      if (value >= -26.0) return 'bg-green-600'
      if (value >= -28.0) return 'bg-orange-600'
      return 'bg-red-600'
    }
    const color = getColor()

    // Heights untuk setiap bar (dari terkecil ke terbesar)
    const barHeights = ['25%', '50%', '75%', '100%']

    return (
      <div className={`flex items-end gap-0.5 ${className}`} style={{ height: '20px', width: '20px' }}>
        {bars.map((filled, index) => (
          <div
            key={index}
            className={`${filled ? color : 'bg-gray-300 dark:bg-gray-600'} rounded-t-sm transition-all`}
            style={{
              width: '3.5px',
              height: filled ? barHeights[index] : '15%',
              minHeight: '3px',
            }}
          />
        ))}
      </div>
    )
  }


  return (
    <div className="space-y-5 p-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <span>Home</span> <span className="mx-2">/</span> <span className="text-gray-900 dark:text-white">All-ONUs</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Good Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Good</h3>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">≥ -26.00 dBm</span>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${(parseFloat(summaryData.good.percentage) / 100) * 175.9} 175.9`}
                  className="text-green-600 dark:text-green-400"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-green-600 dark:text-green-400">{summaryData.good.percentage}%</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">RX OLT</span>
                <span className="font-medium text-gray-900 dark:text-white">{summaryData.good.rxOlt}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all" 
                  style={{ width: summaryData.total > 0 ? `${(summaryData.good.rxOlt / summaryData.total) * 100}%` : '0%' }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">RX ONU</span>
                <span className="font-medium text-gray-900 dark:text-white">{summaryData.good.rxOnu}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all" 
                  style={{ width: summaryData.total > 0 ? `${(summaryData.good.rxOnu / summaryData.total) * 100}%` : '0%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Warning</h3>
              <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">-26.00 ~ -28.00 dBm</span>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${(parseFloat(summaryData.warning.percentage) / 100) * 175.9} 175.9`}
                  className="text-orange-600 dark:text-orange-400"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{summaryData.warning.percentage}%</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">RX OLT</span>
                <span className="font-medium text-gray-900 dark:text-white">{summaryData.warning.rxOlt}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full transition-all" 
                  style={{ width: summaryData.total > 0 ? `${(summaryData.warning.rxOlt / summaryData.total) * 100}%` : '0%' }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">RX ONU</span>
                <span className="font-medium text-gray-900 dark:text-white">{summaryData.warning.rxOnu}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full transition-all" 
                  style={{ width: summaryData.total > 0 ? `${(summaryData.warning.rxOnu / summaryData.total) * 100}%` : '0%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Critical Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Critical</h3>
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">&lt; -28.00 dBm</span>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${(parseFloat(summaryData.critical.percentage) / 100) * 175.9} 175.9`}
                  className="text-red-600 dark:text-red-400"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-red-600 dark:text-red-400">{summaryData.critical.percentage}%</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">RX OLT</span>
                <span className="font-medium text-gray-900 dark:text-white">{summaryData.critical.rxOlt}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full transition-all" 
                  style={{ width: summaryData.total > 0 ? `${(summaryData.critical.rxOlt / summaryData.total) * 100}%` : '0%' }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">RX ONU</span>
                <span className="font-medium text-gray-900 dark:text-white">{summaryData.critical.rxOnu}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-red-600 h-2 rounded-full transition-all" 
                  style={{ width: summaryData.total > 0 ? `${(summaryData.critical.rxOnu / summaryData.total) * 100}%` : '0%' }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Other Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Other</h3>
            </div>
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-gray-200 dark:text-gray-700"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${(parseFloat(summaryData.other.percentage) / 100) * 175.9} 175.9`}
                  className="text-red-600 dark:text-red-400"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <HiBolt className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">LOS</span>
                <span className="font-medium text-gray-900 dark:text-white">{summaryData.other.los}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600 dark:text-gray-400">N/A</span>
                <span className="font-medium text-gray-900 dark:text-white">{summaryData.other.na}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">ONUS (Data Langsung dari SNMP)</h2>
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-medium rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {/* All OLTs Dropdown */}
            <div className="relative" ref={dropdownRefs.olt}>
              <button
                onClick={() => setOpenDropdown(openDropdown === 'olt' ? null : 'olt')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                  selectedOlt ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <HiBars3 className="w-4 h-4" />
                {selectedOlt ? olts.find(o => o.id === selectedOlt)?.name || 'All OLTs' : 'All OLTs'}
                {selectedOlt && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedOlt(null)
                      setSelectedCard(null)
                      setSelectedPort(null)
                      setCards([])
                      setPorts([])
                    }}
                    className="ml-1 hover:bg-green-700 rounded p-0.5 cursor-pointer inline-flex items-center"
                  >
                    <HiXMark className="w-3 h-3" />
                  </span>
                )}
                <HiChevronDown className="w-4 h-4" />
              </button>
              {openDropdown === 'olt' && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedOlt(null)
                      setOpenDropdown(null)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      !selectedOlt ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    All OLTs
                  </button>
                  {olts.map((olt) => (
                    <button
                      key={olt.id}
                      onClick={() => {
                        setSelectedOlt(olt.id)
                        setOpenDropdown(null)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        selectedOlt === olt.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      {olt.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* All Cards Dropdown */}
            <div className="relative" ref={dropdownRefs.card}>
              <button
                onClick={() => hasCardOptions && setOpenDropdown(openDropdown === 'card' ? null : 'card')}
                disabled={!hasCardOptions}
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                  !hasCardOptions
                    ? 'bg-gray-400 cursor-not-allowed'
                    : selectedCard
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <HiOutlineCreditCard className="w-4 h-4" />
                {selectedCard ? `Card ${selectedCard}` : 'All Cards'}
                {selectedCard && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedCard(null)
                      setSelectedPort(null)
                      setPorts([])
                    }}
                    className="ml-1 hover:bg-green-700 rounded p-0.5 cursor-pointer inline-flex items-center"
                  >
                    <HiXMark className="w-3 h-3" />
                  </span>
                )}
                <HiChevronDown className="w-4 h-4" />
              </button>
              {openDropdown === 'card' && hasCardOptions && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedCard(null)
                      setSelectedPort(null)
                      setPorts([])
                      setOpenDropdown(null)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      !selectedCard ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    All Cards
                  </button>
                  {cards.map((card) =>
                    card.slots.map((slot) => (
                      <button
                        key={`${card.frame}/${slot.slot}`}
                        onClick={() => {
                          setSelectedCard(`${card.frame}/${slot.slot}`)
                          setOpenDropdown(null)
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          selectedCard === `${card.frame}/${slot.slot}` ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        Frame {card.frame} / Slot {slot.slot} ({slot.ports.length} ports)
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* All Ports Dropdown */}
            <div className="relative" ref={dropdownRefs.port}>
              <button
                onClick={() => selectedCard && setOpenDropdown(openDropdown === 'port' ? null : 'port')}
                disabled={!selectedCard}
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                  !selectedCard
                    ? 'bg-gray-400 cursor-not-allowed'
                    : selectedPort
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <HiOutlineRectangleStack className="w-4 h-4" />
                {selectedPort ? `Port ${selectedPort.split('/')[2]}` : 'All Ports'}
                {selectedPort && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPort(null)
                    }}
                    className="ml-1 hover:bg-green-700 rounded p-0.5 cursor-pointer inline-flex items-center"
                  >
                    <HiXMark className="w-3 h-3" />
                  </span>
                )}
                <HiChevronDown className="w-4 h-4" />
              </button>
              {openDropdown === 'port' && selectedCard && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedPort(null)
                      setOpenDropdown(null)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      !selectedPort ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    All Ports
                  </button>
                  {ports.map((port) => {
                    const portNum = port.split('/')[2]
                    return (
                      <button
                        key={port}
                        onClick={() => {
                          setSelectedPort(port)
                          setOpenDropdown(null)
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          selectedPort === port ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        Port {portNum}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* All Types Dropdown */}
            <div className="relative" ref={dropdownRefs.type}>
              <button
                onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                  selectedType ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <HiOutlineCog6Tooth className="w-4 h-4" />
                {selectedType || 'All Types'}
                {selectedType && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedType(null)
                    }}
                    className="ml-1 hover:bg-green-700 rounded p-0.5 cursor-pointer inline-flex items-center"
                  >
                    <HiXMark className="w-3 h-3" />
                  </span>
                )}
                <HiChevronDown className="w-4 h-4" />
              </button>
              {openDropdown === 'type' && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
                  {/* Search Bar */}
                  <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative">
                      <HiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={typeSearch}
                        onChange={(e) => setTypeSearch(e.target.value)}
                        placeholder='Search types...'
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  {/* Types List */}
                  <div className="overflow-y-auto flex-1">
                    {/* All Types Option */}
                    <button
                      onClick={() => {
                        setSelectedType(null)
                        setOpenDropdown(null)
                        setTypeSearch('')
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
                        !selectedType ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {!selectedType && (
                          <HiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                        <span className={!selectedType ? 'font-medium' : ''}>All Types</span>
                      </div>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full">
                        {allOnus.length}
                      </span>
                    </button>

                    {/* Filtered Types */}
                    {types.length > 0 ? (
                      types
                        .filter((type) => 
                          type.toLowerCase().includes(typeSearch.toLowerCase())
                        )
                        .map((type) => {
                          const count = typeCounts[type] || 0
                          const isSelected = selectedType === type
                          return (
                            <button
                              key={type}
                              onClick={() => {
                                setSelectedType(type)
                                setOpenDropdown(null)
                                setTypeSearch('')
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
                                isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isSelected && (
                                  <HiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                )}
                                {!isSelected && (
                                  <HiSignal className="w-4 h-4 text-gray-400" />
                                )}
                                <span className={isSelected ? 'font-medium' : ''}>{type}</span>
                              </div>
                              <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-full">
                                {count}
                              </span>
                            </button>
                          )
                        })
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        {loading ? 'Loading types...' : 'No types available. Please refresh data.'}
                      </div>
                    )}
                    
                    {/* No Results from Search */}
                    {types.length > 0 && types.filter((type) => 
                      type.toLowerCase().includes(typeSearch.toLowerCase())
                    ).length === 0 && typeSearch && (
                      <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No types found matching &quot;{typeSearch}&quot;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Legend */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
            <HiCheckCircle className="w-5 h-5 text-green-600" />
            <HiExclamationTriangle className="w-5 h-5 text-yellow-600" />
            <HiBolt className="w-5 h-5 text-red-600" />
            <HiInformationCircle className="w-5 h-5 text-blue-600" />
            <HiQuestionMarkCircle className="w-5 h-5 text-gray-600" />
          </div>

          {/* Signal Legend */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">Signal:</span>
            <SignalBars rxOlt="-25.0" />
            <SignalBars rxOlt="-27.0" />
            <SignalBars rxOlt="-28.5" />
            <SignalBars rxOlt="-30.0" />
          </div>

          {/* Export Button */}
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
            <HiArrowDownTray className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Search and Entries */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Show</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value))
                setPage(1)
                setNextCursor(0)
                setOnus([])
              }}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">entries</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Search:</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Search..."
            />
          </div>
        </div>
      </div>

      {/* Data Table - Optimized dengan pagination dan Load More */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" className="rounded border-gray-300" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  OLT
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  PPPoE
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  Gpon Onu
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  RX OLT
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  RX ONU
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  Serial Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  Actual Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {loading ? (
                <tr key="loading">
                  <td colSpan={12} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <HiArrowPath className="w-5 h-5 animate-spin" />
                      Memuat data ONU...
                    </div>
                  </td>
                </tr>
              ) : onus.length === 0 ? (
                <tr key="empty">
                  <td colSpan={12} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada data ONU. Klik &quot;Refresh&quot; untuk mengambil data dari OLT C300.
                  </td>
                </tr>
              ) : (
                onus.map((onu, index) => (
                  <tr key={`${onu.oltId}-${onu.gponOnu}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{onu.oltName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{onu.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{onu.description || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{onu.pppoe || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                        {onu.gponOnu}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(onu.status)}
                        <span className="text-sm text-gray-900 dark:text-white capitalize">{onu.status}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <SignalBars rxOlt={onu.rxOlt} />
                        <span className={`text-sm font-medium ${getSignalColor(onu.rxOlt)}`}>
                          {onu.rxOlt || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <SignalBars rxOlt={onu.rxOnu} />
                        <span className={`text-sm font-medium ${getSignalColor(onu.rxOnu)}`}>
                          {onu.rxOnu || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {onu.serialNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{onu.actualType || '-'}</td>
                    <td className="px-4 py-3">
                      <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors">
                        <HiCog6Tooth className="w-4 h-4" />
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
              {pagination.total > 0 ? (
                <>
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} entries
                </>
              ) : (
                <>No entries</>
              )}
            </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {(() => {
              const totalPages = pagination.totalPages
              if (totalPages === 0) return null
              
              const getPageNumbers = () => {
                const pages: (number | string)[] = []
                const maxVisible = 5
                
                if (totalPages <= maxVisible) {
                  // Tampilkan semua halaman jika total halaman <= 5
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i)
                  }
                } else {
                  // Tampilkan halaman di sekitar halaman saat ini
                  if (page <= 3) {
                    // Dekat dengan awal
                    for (let i = 1; i <= 4; i++) {
                      pages.push(i)
                    }
                    pages.push('...')
                    pages.push(totalPages)
                  } else if (page >= totalPages - 2) {
                    // Dekat dengan akhir
                    pages.push(1)
                    pages.push('...')
                    for (let i = totalPages - 3; i <= totalPages; i++) {
                      pages.push(i)
                    }
                  } else {
                    // Di tengah
                    pages.push(1)
                    pages.push('...')
                    for (let i = page - 1; i <= page + 1; i++) {
                      pages.push(i)
                    }
                    pages.push('...')
                    pages.push(totalPages)
                  }
                }
                
                return pages
              }
              
              const pageNumbers = getPageNumbers()
              
              return pageNumbers.map((pageNum, index) => {
                if (pageNum === '...') {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 text-sm text-gray-500">
                      ...
                    </span>
                  )
                }
                
                const num = pageNum as number
                return (
                  <button
                    key={num}
                    onClick={() => setPage(num)}
                    disabled={loading}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      page === num
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {num}
                  </button>
                )
              })
            })()}
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages || loading}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

