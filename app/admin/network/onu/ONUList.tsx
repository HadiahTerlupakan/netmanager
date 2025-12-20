"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  HiCheckCircle,
  HiExclamationTriangle,
  HiBolt,
  HiInformationCircle,
  HiQuestionMarkCircle,
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
  HiSignal,
  HiFunnel
} from 'react-icons/hi2'
import { useSocket, useSocketEvent } from '@/lib/websocket/SocketContext'

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
  // SNMP OID fields
  statusOid?: string | null
  rxOltOid?: string | null
  rxOnuOid?: string | null
  nameOid?: string | null
  descOid?: string | null
  compositeIndex?: number | null
  olt?: {
    id: string
    name: string
  }
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
const GRID_TEMPLATE_COLUMNS = '60px 170px 220px 240px 150px 140px 140px 140px 150px 200px 120px'
const LIVE_DATA_CACHE_TTL = 30 * 1000 // 30 detik cache untuk data live

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
  // allOnus removed - server side pagination
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

  // Separate loading state for summary (to avoid blocking list)
  const [summaryLoading, setSummaryLoading] = useState(true)

  // Cache untuk data live dari SNMP GET (key: gponOnu, value: OnuData)
  const liveDataCacheRef = useRef<Map<string, { data: OnuData; timestamp: number }>>(new Map())


  const dropdownRefs = {
    olt: useRef<HTMLDivElement>(null),
    card: useRef<HTMLDivElement>(null),
    port: useRef<HTMLDivElement>(null),
    type: useRef<HTMLDivElement>(null),
  }
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const searchRef = useRef(search)
  const selectedCardRef = useRef(selectedCard)
  const selectedPortRef = useRef(selectedPort)
  const selectedTypeRef = useRef(selectedType)
  const hasCardOptions = cards.length > 0

  const calculatePercentage = (count: number, total: number) => {
    if (total === 0) return '0%'
    return `${Math.round((count / total) * 100)}%`
  }

  const fetchOlts = async () => {
    try {
      const res = await fetch('/api/olts')
      const data = await res.json()
      if (data.olts) {
        // Ambil semua OLT, tidak perlu filter SNMP status
        // Data akan diambil dari database yang sudah di-sync
        const allOlts = data.olts.map((olt: any) => ({
          id: olt.id,
          name: olt.name,
          ipAddress: olt.ipAddress,
          type: olt.type,
          snmpConnected: olt.snmpConnected,
          snmpCommunityWrite: olt.snmpCommunityWrite,
          snmpPort: olt.snmpPort,
          snmpVersion: olt.snmpVersion,
        }))
        setOlts(allOlts)
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

  // Fetch types data separate from main list
  const fetchTypes = useCallback(async () => {
    // This could also be an API endpoint, for now we assume it comes with list or separate
    // In server-side pagination, we might need a dedicated endpoint for filters
  }, [])

  type FetchOptions = {
    reset?: boolean
    cursorOverride?: number
    searchValue?: string
  }

  // Fungsi untuk update ONU yang sedang ditampilkan menggunakan SNMP GET
  // Mengembalikan data terbaru yang sudah di-update

  const updateDisplayedOnus = useCallback(async (onusToUpdate: OnuData[]): Promise<OnuData[] | null> => {
    try {
      // Siapkan data untuk update
      const onuList = onusToUpdate.map(onu => ({
        gponOnu: onu.gponOnu,
        oltId: onu.oltId,
      }))

      console.log(`[All-ONU] Updating ${onuList.length} displayed ONUs via SNMP GET...`)

      // Panggil API untuk update
      const res = await fetch('/api/onus/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ onuList }),
      })

      const updateResult = await res.json()

      if (updateResult.success && updateResult.onus) {
        // Update state dengan data terbaru
        const updatedOnusMap = new Map<string, any>()
        for (const updatedOnu of updateResult.onus) {
          if (updatedOnu.updated && updatedOnu.data) {
            updatedOnusMap.set(updatedOnu.gponOnu, updatedOnu.data)
          }
        }

        // Merge data terbaru dengan data yang ada
        // Hanya update field yang benar-benar ada datanya dari SNMP GET
        const updatedOnus = onusToUpdate.map(onu => {
          const updatedData = updatedOnusMap.get(onu.gponOnu)
          if (updatedData && updatedData.status) {
            // Hanya update jika ada status dari SNMP GET (ini indikator bahwa SNMP GET berhasil)
            // Update semua field yang ada datanya dari SNMP GET
            return {
              ...onu,
              status: updatedData.status, // Status dari SNMP GET (harus ada)
              rxOlt: (updatedData.rxOlt && updatedData.rxOlt !== 'N/A') ? updatedData.rxOlt : onu.rxOlt,
              rxOnu: (updatedData.rxOnu && updatedData.rxOnu !== 'N/A') ? updatedData.rxOnu : onu.rxOnu,
              name: updatedData.name || onu.name,
              description: updatedData.description !== undefined && updatedData.description !== null ? updatedData.description : onu.description,
            }
          }
          // Jika tidak ada data dari SNMP GET (tidak ada status), tetap gunakan data dari database
          console.warn(`[All-ONU] No SNMP GET data for ${onu.gponOnu}, keeping database data`)
          return onu
        })

        console.log(`[All-ONU] Successfully updated ${updateResult.updated}/${updateResult.total} ONUs via SNMP GET`)
        return updatedOnus
      } else {
        console.warn(`[All-ONU] Failed to update ONUs:`, updateResult.error)
        return null
      }
    } catch (error: any) {
      console.error(`[All-ONU] Error updating displayed ONUs:`, error.message)
      return null
    }
  }, [])



  // Fetch summary stats from API
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true)
      const params = new URLSearchParams()
      // Only filter summary by OLT
      if (selectedOlt) params.append('oltId', selectedOlt)

      const res = await fetch(`/api/onus/stats?${params.toString()}`)
      const data = await res.json()

      if (data && !data.error) {
        setSummaryData({
          total: data.total,
          good: {
            count: data.goodSignal || 0,
            percentage: calculatePercentage(data.goodSignal || 0, data.total),
            rxOlt: 0,
            rxOnu: 0
          },
          warning: {
            count: data.warningSignal || 0,
            percentage: calculatePercentage(data.warningSignal || 0, data.total),
            rxOlt: 0,
            rxOnu: 0
          },
          critical: {
            count: (data.criticalSignal || 0) + data.los,
            percentage: calculatePercentage((data.criticalSignal || 0) + data.los, data.total),
            rxOlt: 0,
            rxOnu: 0
          },
          other: {
            count: data.dyingGasp + data.uncfg + data.disabled + data.offline,
            percentage: calculatePercentage(data.dyingGasp + data.uncfg + data.disabled + data.offline, data.total),
            los: data.los,
            na: data.uncfg + data.disabled + data.offline
          }
        })
      }
    } catch (error) {
      console.error('Error fetching summary:', error)
    } finally {
      setSummaryLoading(false)
    }
  }, [selectedOlt])

  const fetchOnus = useCallback(async (options: FetchOptions = {}) => {
    const { reset = false, cursorOverride, searchValue } = options
    const appliedSearch = searchValue ?? searchRef.current ?? ''

    // Reset page if filtering changes (except pagination itself)
    const targetPage = reset ? 1 : page

    if (reset) {
      setLoading(true)
      setOnus([])
    } else if (onus.length === 0) {
      setLoading(true)
    }

    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: limit.toString(),
      })
      if (appliedSearch.trim()) params.append('search', appliedSearch.trim())
      if (selectedOlt) params.append('oltId', selectedOlt)
      if (selectedCard) params.append('card', selectedCard)
      if (selectedPort) params.append('port', selectedPort)
      if (selectedType) params.append('type', selectedType)

      const res = await fetch(`/api/onus?${params.toString()}`)
      const data = await res.json()

      if (data.error) {
        console.error('Error from API:', data.error)
        setOnus([])
        return
      }

      const incomingOnus: OnuData[] = data.onus || []

      // Update displayed ONUs locally first
      setOnus(incomingOnus)

      setPagination({
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages
      })

      // Trigger background update for displayed items
      if (incomingOnus.length > 0) {
        updateDisplayedOnus(incomingOnus).then(updated => {
          if (updated) {
            setOnus(prev => {
              // Merge updates
              const map = new Map(prev.map(p => [p.gponOnu, p]))
              updated.forEach(u => map.set(u.gponOnu, u))
              return Array.from(map.values())
            })
          }
        })
      }

    } catch (error) {
      console.error('Error fetching ONUs:', error)
      if (reset) setOnus([])
    } finally {
      setLoading(false)
    }
  }, [limit, page, selectedOlt, selectedCard, selectedPort, selectedType, updateDisplayedOnus])

  // Initial fetch for summary
  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // updateTypesFromOnus removed - not used in server pagination
  // fetchTypes removed - handled in fetchOnus or separate API if needed (currently disabled)

  useEffect(() => {
    searchRef.current = search
  }, [search])

  // Update refs untuk filter (untuk digunakan di polling tanpa trigger re-render)
  useEffect(() => {
    selectedCardRef.current = selectedCard
  }, [selectedCard])

  useEffect(() => {
    selectedPortRef.current = selectedPort
  }, [selectedPort])

  useEffect(() => {
    selectedTypeRef.current = selectedType
  }, [selectedType])

  // WebSocket Integration
  const { socket, isConnected } = useSocket()

  // Listen for ONU updates
  useSocketEvent<{ gponOnu: string; data: any; updated: boolean }>('onu:updated', (update) => {
    if (!update || !update.gponOnu) return

    // Update state live (non-blocking)
    setOnus(prevOnus => {
      // Cek apakah ONU yang diupdate ada di list saat ini
      const needsUpdate = prevOnus.some(o => o.gponOnu === update.gponOnu)
      if (!needsUpdate) return prevOnus

      const updatedMap = new Map(prevOnus.map(onu => [onu.gponOnu, onu]))
      const current = updatedMap.get(update.gponOnu)

      if (current && update.data) {
        // Merge data update
        const updatedOnu = {
          ...current,
          status: update.data.status || current.status,
          rxOlt: (update.data.rxOlt && update.data.rxOlt !== 'N/A') ? update.data.rxOlt : current.rxOlt,
          rxOnu: (update.data.rxOnu && update.data.rxOnu !== 'N/A') ? update.data.rxOnu : current.rxOnu,
          // Only update fields that are present in the update payload
          name: update.data.name || current.name,
          description: update.data.description ?? current.description,
        }
        updatedMap.set(update.gponOnu, updatedOnu)
      }

      const finalOnus = Array.from(updatedMap.values())
      // Recalculate summary only if needed (optional optimization)
      // For global stats we should ideally fetch from server, but for frequent updates
      // we might just want to trigger it throttled. For now, let's just trigger it.
      fetchSummary()

      return finalOnus
    })

    // Update cache
    if (update.data) {
      liveDataCacheRef.current.set(update.gponOnu, {
        data: update.data,
        timestamp: Date.now()
      })
    }
  })

  // Emit monitoring interest when onus list changes
  useEffect(() => {
    if (socket && isConnected) {
      // Only monitor items currently on screen
      const itemsToMonitor = onus.map(o => ({
        gponOnu: o.gponOnu,
        oltId: o.oltId
      })).filter(o => o.gponOnu && o.oltId)

      if (itemsToMonitor.length > 0) {
        socket.emit('monitor_onus', itemsToMonitor)
        console.log(`[WS] Monitoring ${itemsToMonitor.length} ONUs`)
      } else {
        // If empty (e.g. loading or filter empty), monitor nothing
        socket.emit('monitor_onus', [])
      }
    }
  }, [onus, socket, isConnected])

  // Join admin:onu room
  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('join_room', 'admin:onu')
    }
    return () => {
      if (socket && isConnected) {
        socket.emit('leave_room', 'admin:onu')
      }
    }
  }, [socket, isConnected])

  // Page Visibility - re-emit monitoring when visible
  // The server might have cleaned up if we disconnected or timed out
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && socket && isConnected && onus.length > 0) {
        const itemsToMonitor = onus.map(o => ({
          gponOnu: o.gponOnu,
          oltId: o.oltId
        })).filter(o => o.gponOnu && o.oltId)
        console.log(`[WS] Page visible, refreshing monitoring for ${itemsToMonitor.length} ONUs`)
        socket.emit('monitor_onus', itemsToMonitor)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [socket, isConnected, onus])


  const handleRefresh = async () => {
    // Refresh manual: akan melakukan SNMP GET untuk semua ONU yang ditampilkan
    // Ini akan mengambil data terbaru langsung dari OLT via SNMP GET
    setNextCursor(0)
    setPage(1)
    try {
      // Kirim forceRefresh untuk clear cache dan ambil data fresh dari database
      const params = new URLSearchParams({
        page: '1',
        limit: limit.toString(),
        cursor: '0',
        forceRefresh: 'true', // Force refresh untuk clear cache
      })
      if (searchRef.current?.trim()) params.append('search', searchRef.current.trim())
      if (selectedOlt) params.append('oltId', selectedOlt)
      if (selectedCard) params.append('card', selectedCard)
      if (selectedPort) params.append('port', selectedPort)
      if (selectedType) params.append('type', selectedType)

      setLoading(true)
      setOnus([])

      const res = await fetch(`/api/onus?${params.toString()}`)
      const data = await res.json()

      if (data.error) {
        console.error('Error from API:', data.error)
        alert(`Error: ${data.error}`)
        setOnus([])
        setOnus([])
        fetchSummary()
        setPagination(data.pagination || { ...INITIAL_PAGINATION, limit })
        return
      }

      const incomingOnus: OnuData[] = data.onus || []

      // Refresh: Clear cache dan langsung lakukan SNMP GET untuk mendapatkan data live
      // Tampilkan data live langsung, bukan data dari database
      if (incomingOnus.length > 0) {
        // Clear cache untuk ONU yang akan di-refresh
        for (const onu of incomingOnus) {
          liveDataCacheRef.current.delete(onu.gponOnu)
        }

        console.log(`[All-ONU] Refresh: Fetching live data for ${incomingOnus.length} ONUs via SNMP GET...`)

        // Set loading state
        setLoading(true)

        // Lakukan SNMP GET terlebih dahulu untuk mendapatkan data live
        const updatedOnus = await updateDisplayedOnus(incomingOnus)

        if (updatedOnus && updatedOnus.length > 0) {
          // Update cache dengan data live baru
          const now = Date.now()
          for (const onu of updatedOnus) {
            liveDataCacheRef.current.set(onu.gponOnu, {
              data: onu,
              timestamp: now
            })
          }

          // Tampilkan data live langsung
          setOnus(updatedOnus)
          fetchSummary()
          console.log(`[All-ONU] Refresh: Displaying live data from SNMP GET for ${updatedOnus.length} ONUs`)
        } else {
          // Fallback ke data database jika SNMP GET gagal
          console.warn(`[All-ONU] Refresh: SNMP GET failed, using database data as fallback`)
          setOnus(incomingOnus)
          fetchSummary()
        }
      } else {
        setOnus(incomingOnus)
        // If no data or just DB data, ensure summary is updated from server
        fetchSummary()
      }

      setPagination(data.pagination || { ...INITIAL_PAGINATION, limit })
      setNextCursor(data.nextCursor ?? null)

      if (data.types && data.typeCounts) {
        setTypes(data.types)
        setTypeCounts(data.typeCounts)
        // allOnus store removed
      }

      if (!selectedOlt && data.cards) {
        setGlobalCards(data.cards)
        setCards(data.cards)
      }
    } catch (error: any) {
      console.error('Error refreshing ONUs:', error)
      alert('Terjadi kesalahan saat refresh: ' + (error.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOlts()
  }, [])

  // Auto-fetch data saat OLTs sudah dimuat (langsung tampilkan semua data tanpa perlu pilih OLT)
  useEffect(() => {
    if (olts.length > 0) {
      fetchOnus({ reset: true })
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
    // Fetch data untuk semua OLT (tidak perlu pilih OLT dulu)
    if (olts.length > 0) {
      const cursorForPage = (page - 1) * limit
      // Jangan clear data dan set loading saat pagination - biarkan data tetap tampil
      // Loading hanya akan muncul jika benar-benar perlu fetch dari server
      // Jika cache tersedia, data akan langsung muncul tanpa loading
      setNextCursor(cursorForPage)
      // Jangan kirim reset=true saat pagination - biarkan cache digunakan
      // Cache akan digunakan otomatis oleh API jika masih valid
      // Jangan set loading di sini - biarkan fetchOnus yang handle berdasarkan cache
      // fetchOnus akan clear loading dengan cepat jika data dari cache
      fetchOnus({ reset: false, cursorOverride: cursorForPage })
    } else {
      // Clear data jika OLT belum di-load
      setOnus([])
      setSummaryData(INITIAL_SUMMARY)
      setPagination({ ...INITIAL_PAGINATION, limit })
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, selectedOlt, selectedCard, selectedPort, selectedType])

  useEffect(() => {
    // Hanya search jika OLT sudah dipilih
    if (selectedOlt) {
      const timer = setTimeout(() => {
        setPage(1)
        setNextCursor(0)
        setOnus([])
        fetchOnus({ reset: true, cursorOverride: 0 })
      }, 500)

      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedOlt])

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
          <div className="flex items-center gap-3">
            {/* Live Update Status */}
            {selectedOlt && (
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${isConnected
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  {isConnected ? 'Live Updates Active' : 'Offline'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Warning jika OLT belum dipilih */}
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <HiInformationCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Data ONU dari Semua OLT
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Menampilkan data ONU dari semua OLT yang terhubung. Data diambil dari database yang di-update secara otomatis setiap 5 menit oleh background scheduler. Gunakan filter OLT di atas untuk melihat data dari OLT tertentu.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {/* All OLTs Dropdown - WAJIB DIPILIH */}
            <div className="relative" ref={dropdownRefs.olt}>
              <button
                onClick={() => setOpenDropdown(openDropdown === 'olt' ? null : 'olt')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${selectedOlt ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                <HiBars3 className="w-4 h-4" />
                {selectedOlt ? olts.find(o => o.id === selectedOlt)?.name || 'Pilih OLT' : 'Pilih OLT *'}
                {selectedOlt && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedOlt(null)
                      setSelectedCard(null)
                      setSelectedPort(null)
                      setCards([])
                      setPorts([])
                      setOnus([])
                      setSummaryData(INITIAL_SUMMARY)
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
                  {olts.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      Tidak ada OLT yang tersedia. Pastikan OLT sudah dikonfigurasi dengan SNMP.
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                        Pilih OLT (Opsional - Filter)
                      </div>
                      {olts.map((olt) => (
                        <button
                          key={olt.id}
                          onClick={() => {
                            setSelectedOlt(olt.id)
                            setOpenDropdown(null)
                            // Reset filters saat ganti OLT
                            setSelectedCard(null)
                            setSelectedPort(null)
                            setSelectedType(null)
                            setPage(1)
                            setNextCursor(0)
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedOlt === olt.id ? 'bg-blue-50 dark:bg-blue-900/20 font-medium' : ''
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{olt.name}</span>
                            {selectedOlt === olt.id && (
                              <HiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {olt.ipAddress}
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* All Cards Dropdown */}
            <div className="relative" ref={dropdownRefs.card}>
              <button
                onClick={() => hasCardOptions && setOpenDropdown(openDropdown === 'card' ? null : 'card')}
                disabled={!hasCardOptions}
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${!hasCardOptions || !selectedOlt
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
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${!selectedCard ? 'bg-blue-50 dark:bg-blue-900/20' : ''
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
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedCard === `${card.frame}/${slot.slot}` ? 'bg-blue-50 dark:bg-blue-900/20' : ''
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
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${!selectedCard || !selectedOlt
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
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${!selectedPort ? 'bg-blue-50 dark:bg-blue-900/20' : ''
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
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${selectedPort === port ? 'bg-blue-50 dark:bg-blue-900/20' : ''
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
                disabled={false}
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${!selectedOlt
                  ? 'bg-gray-400 cursor-not-allowed'
                  : selectedType
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700'
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
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${!selectedType ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        {!selectedType && (
                          <HiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        )}
                        <span className={!selectedType ? 'font-medium' : ''}>All Types</span>
                      </div>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded-full">
                        {pagination.total}
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
                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
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

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={!selectedOlt}
            className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${!selectedOlt
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
              }`}
            title="Refresh manual: Lakukan SNMP GET untuk update data ONU yang ditampilkan"
          >
            <HiArrowPath className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Export Button */}
          <button
            disabled={!selectedOlt}
            className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${!selectedOlt
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
              }`}
          >
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
              disabled={!selectedOlt}
              className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white ${!selectedOlt ? 'opacity-50 cursor-not-allowed' : ''
                }`}
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
              disabled={!selectedOlt}
              className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${!selectedOlt ? 'opacity-50 cursor-not-allowed' : ''
                }`}
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
                    Tidak ada data ONU di database. Data akan tersedia setelah background scheduler sync (runs every 5 minutes). Klik &quot;Refresh&quot; untuk force fetch dari SNMP.
                  </td>
                </tr>
              ) : (
                onus.map((onu, index) => (
                  <tr key={`${onu.oltId}-${onu.gponOnu}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{onu.olt?.name || '-'}</td>
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
                      <div className="flex items-center gap-2">
                        <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors">
                          <HiCog6Tooth className="w-4 h-4" />
                          Setting
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
              onClick={() => {
                setPage(p => Math.max(1, p - 1))
              }}
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
                    onClick={() => {
                      setPage(num)
                    }}
                    disabled={loading}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${page === num
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
              onClick={() => {
                setPage(p => Math.min(pagination.totalPages, p + 1))
              }}
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

