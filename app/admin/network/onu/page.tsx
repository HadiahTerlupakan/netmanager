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
  // SNMP OID fields
  statusOid?: string | null
  rxOltOid?: string | null
  rxOnuOid?: string | null
  nameOid?: string | null
  descOid?: string | null
  compositeIndex?: number | null
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
  
  // Polling state
  const [pollingEnabled, setPollingEnabled] = useState(true)
  const [pollingInterval, setPollingInterval] = useState(30) // detik
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null)
  
  // SNMP TABLE test modal state
  const [testTableModalOpen, setTestTableModalOpen] = useState(false)
  const [testTableLoading, setTestTableLoading] = useState(false)
  const [testTableResult, setTestTableResult] = useState<any>(null)
  const [testTableError, setTestTableError] = useState<string | null>(null)
  const [selectedOnuForTest, setSelectedOnuForTest] = useState<OnuData | null>(null)
  
  // Cache untuk data live dari SNMP GET (key: gponOnu, value: OnuData)
  const liveDataCacheRef = useRef<Map<string, { data: OnuData; timestamp: number }>>(new Map())
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPageVisibleRef = useRef(true)
  const isPollingRef = useRef(false) // Flag untuk mencegah multiple polling concurrent
  const isPaginationRef = useRef(false) // Flag untuk mencegah polling saat pagination
  const pollingAbortControllerRef = useRef<AbortController | null>(null) // Untuk cancel polling request
  
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

  // Fungsi untuk update ONU yang sedang ditampilkan menggunakan SNMP GET
  // Mengembalikan data terbaru yang sudah di-update
  // Fungsi untuk test SNMP TABLE
  const handleTestSnmpTable = async (onu: OnuData) => {
    if (!onu.statusOid || !onu.compositeIndex) {
      alert('ONU belum memiliki OID yang tersimpan. Silakan sync ONU terlebih dahulu.')
      return
    }

    setSelectedOnuForTest(onu)
    setTestTableModalOpen(true)
    setTestTableLoading(true)
    setTestTableResult(null)
    setTestTableError(null)

    try {
      const res = await fetch('/api/onus/test-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          onuId: onu.id,
          oltId: onu.oltId,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setTestTableResult(data)
      } else {
        setTestTableError(data.error || 'Gagal test SNMP TABLE')
      }
    } catch (error: any) {
      setTestTableError(error.message || 'Gagal test SNMP TABLE')
    } finally {
      setTestTableLoading(false)
    }
  }

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

  const fetchOnus = useCallback(async (options: FetchOptions = {}) => {
    const { reset = false, cursorOverride, searchValue } = options
    const appliedSearch = searchValue ?? searchRef.current ?? ''
    
    // Set flag pagination untuk mencegah polling saat pagination
    const isPaginationRequest = !reset && onus.length > 0
    if (isPaginationRequest) {
      isPaginationRef.current = true
    }
    
    // Untuk pagination, selalu gunakan cursor dari page
    const calculatedCursor = (page - 1) * limit
    const targetCursor = cursorOverride !== undefined && cursorOverride !== null
      ? cursorOverride
      : calculatedCursor

    if (targetCursor < 0 || isNaN(targetCursor)) {
      if (isPaginationRequest) {
        isPaginationRef.current = false
      }
      return
    }

    // Hanya set loading jika reset (perubahan filter) atau jika tidak ada data
    // Jangan set loading untuk pagination karena cache akan langsung memberikan data
    // Ini mencegah loading indicator muncul saat pagination dengan cache
    if (reset) {
      setLoading(true)
      setOnus([])
    } else if (onus.length === 0) {
      // Hanya set loading jika tidak ada data (first load)
      setLoading(true)
    }
    // Jika pagination dan sudah ada data, jangan set loading - biarkan cache handle

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
      // Jangan kirim forceRefresh saat pagination - hanya saat benar-benar refresh manual
      // forceRefresh hanya untuk refresh button atau perubahan filter yang signifikan
      // if (reset) params.append('forceRefresh', 'true')

      const res = await fetch(`/api/onus?${params.toString()}`)
      const data = await res.json()

      // Clear loading lebih cepat jika data dari cache (baik reset maupun pagination)
      // Ini mencegah loading indicator muncul saat pagination dengan cache
      if (data.fromCache) {
        setLoading(false)
        loadingCleared = true
        console.log(`[All-ONU] Data from cache (age: ${data.cacheAge || 'unknown'}s), loading cleared immediately - no loading indicator`)
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
      
      // OPTIMASI: Tampilkan data database dulu (instant), lalu update via SNMP GET di background
      // Ini mencegah loading lama saat paginasi
      const now = Date.now()
      const cachedOnus: OnuData[] = []
      const onusToFetch: OnuData[] = []
      
      for (const onu of incomingOnus) {
        const cached = liveDataCacheRef.current.get(onu.gponOnu)
        if (cached && (now - cached.timestamp) < LIVE_DATA_CACHE_TTL) {
          // Gunakan data dari cache jika masih fresh
          cachedOnus.push(cached.data)
        } else {
          // Perlu fetch dari SNMP GET (tapi tidak blocking)
          onusToFetch.push(onu)
        }
      }
      
      // Tampilkan data database/cache dulu (instant) - tidak blocking
      // Clear loading state segera setelah data ditampilkan (tidak menunggu SNMP GET)
      if (cachedOnus.length === incomingOnus.length) {
        // Semua data ada di cache, tampilkan langsung
        setOnus(cachedOnus)
        const newSummary = calculateSummary(cachedOnus)
        setSummaryData(newSummary)
        setLoading(false) // Clear loading segera
        loadingCleared = true
        console.log(`[All-ONU] Using cached live data for ${cachedOnus.length} ONUs`)
      } else {
        // Tampilkan data database/cache dulu (instant)
        const displayOnus = [...cachedOnus, ...incomingOnus.filter(onu => !cachedOnus.find(c => c.gponOnu === onu.gponOnu))]
        setOnus(displayOnus)
        setSummaryData(data.summary || INITIAL_SUMMARY)
        setLoading(false) // Clear loading segera - tidak menunggu SNMP GET
        loadingCleared = true
        console.log(`[All-ONU] Displaying database data instantly (${displayOnus.length} ONUs), updating ${onusToFetch.length} ONUs in background...`)
        
        // Lakukan SNMP GET di background (non-blocking) setelah data ditampilkan
        if (onusToFetch.length > 0) {
          // Update via SNMP GET di background (tidak blocking UI)
          updateDisplayedOnus(onusToFetch).then((updatedOnus) => {
            if (updatedOnus && updatedOnus.length > 0) {
              // Update cache dengan data live
              for (const onu of updatedOnus) {
                liveDataCacheRef.current.set(onu.gponOnu, {
                  data: onu,
                  timestamp: Date.now()
                })
              }
              
              // Update UI dengan data live (non-blocking)
              setOnus(prevOnus => {
                const updatedMap = new Map(prevOnus.map(onu => [onu.gponOnu, onu]))
                for (const updatedOnu of updatedOnus) {
                  updatedMap.set(updatedOnu.gponOnu, updatedOnu)
                }
                const finalOnus = Array.from(updatedMap.values())
                // Update summary dengan data live
                const newSummary = calculateSummary(finalOnus)
                setSummaryData(newSummary)
                return finalOnus
              })
              
              console.log(`[All-ONU] Background update: Updated ${updatedOnus.length} ONUs via SNMP GET`)
            } else {
              console.warn(`[All-ONU] Background update: SNMP GET failed, keeping database data`)
            }
          }).catch((error) => {
            console.error(`[All-ONU] Background update error:`, error)
            // Tetap tampilkan data database jika SNMP GET gagal
          })
        }
      }
      
      // Jika data dari cache, pastikan loading sudah di-clear
      // Ini untuk memastikan tidak ada loading indicator yang tersisa
      if (data.fromCache && !loadingCleared) {
        setLoading(false)
        loadingCleared = true
      }
      setPagination(data.pagination || { ...INITIAL_PAGINATION, limit })
      // Update nextCursor untuk tracking, tapi untuk pagination kita gunakan page-based
      setNextCursor(data.nextCursor ?? null)
      
      // Clear pagination flag setelah data berhasil di-load
      if (isPaginationRequest) {
        // Delay kecil untuk memastikan state update selesai
        setTimeout(() => {
          isPaginationRef.current = false
        }, 500)
      }

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
      // Clear loading jika belum di-clear (baik reset maupun pagination)
      // Tapi hanya jika belum di-clear oleh cache check
      if (!loadingCleared) {
        setLoading(false)
      }
      
      // Clear pagination flag di finally untuk memastikan selalu di-clear
      if (isPaginationRequest) {
        setTimeout(() => {
          isPaginationRef.current = false
        }, 500)
      }
    }
  }, [limit, page, selectedCard, selectedOlt, selectedPort, selectedType, onus.length, updateDisplayedOnus])

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

  // Polling function - Non-blocking, tidak mengganggu pagination
  const startPolling = useCallback(() => {
    // Stop polling sebelumnya jika ada
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    // Hanya start polling jika OLT sudah dipilih dan polling enabled
    if (!selectedOlt || !pollingEnabled) {
      return
    }

    console.log(`[Polling] Starting polling with interval ${pollingInterval}s`)
    
    // Polling function - Non-blocking, hanya refresh data tanpa mengubah pagination
    const poll = async () => {
      // Skip jika halaman tidak visible
      if (!isPageVisibleRef.current) {
        console.log(`[Polling] Page not visible, skipping poll`)
        return
      }

      // Skip jika sedang pagination (user sedang navigate)
      if (isPaginationRef.current) {
        console.log(`[Polling] Pagination in progress, skipping poll`)
        return
      }

      // Skip jika polling sedang berjalan (prevent concurrent polling)
      if (isPollingRef.current) {
        console.log(`[Polling] Previous poll still running, skipping`)
        return
      }

      // Cancel previous request jika ada
      if (pollingAbortControllerRef.current) {
        pollingAbortControllerRef.current.abort()
      }

      // Create new abort controller untuk request ini
      const abortController = new AbortController()
      pollingAbortControllerRef.current = abortController

      isPollingRef.current = true
      console.log(`[Polling] Fetching data (background, non-blocking)...`)
      setLastPollTime(new Date())
      
      try {
        // Polling hanya refresh data untuk halaman saat ini, tidak mengubah state
        // Gunakan current page dan limit, tapi jangan trigger state update yang bisa conflict
        // Gunakan ref untuk mendapatkan nilai current tanpa trigger re-render
        const currentPage = page
        const currentLimit = limit
        const cursorForPage = (currentPage - 1) * currentLimit

        // Fetch dengan abort signal untuk bisa di-cancel jika perlu
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: currentLimit.toString(),
          cursor: cursorForPage.toString(),
        })
        // Polling untuk semua OLT (tidak perlu kirim oltId jika tidak dipilih)
        // Gunakan selectedOlt dari state (akan di-capture dalam closure)
        if (selectedOlt) params.append('oltId', selectedOlt)
        // Gunakan ref untuk filter yang berubah (tidak perlu di dependency array)
        const currentCard = selectedCardRef.current
        const currentPort = selectedPortRef.current
        const currentType = selectedTypeRef.current
        if (currentCard) params.append('card', currentCard)
        if (currentPort) params.append('port', currentPort)
        if (currentType) params.append('type', currentType)
        const searchValue = searchRef.current
        if (searchValue?.trim()) params.append('search', searchValue.trim())

        const res = await fetch(`/api/onus?${params.toString()}`, {
          signal: abortController.signal,
        })

        // Check jika request di-cancel
        if (abortController.signal.aborted) {
          console.log(`[Polling] Request cancelled`)
          return
        }

        const data = await res.json()

        // Hanya update jika tidak ada error dan tidak sedang pagination
        if (!data.error && !isPaginationRef.current) {
          // Update data secara non-blocking, tidak mengubah pagination state
          if (data.onus && data.onus.length > 0) {
            setOnus(data.onus)
            setSummaryData(data.summary || INITIAL_SUMMARY)
            // Jangan update pagination dari polling, biarkan user control
            console.log(`[Polling] Data refreshed (${data.onus.length} ONUs)`)
          }
        }
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === 'AbortError') {
          console.log(`[Polling] Request aborted`)
          return
        }
        console.error('[Polling] Error during poll:', error)
      } finally {
        isPollingRef.current = false
        if (pollingAbortControllerRef.current === abortController) {
          pollingAbortControllerRef.current = null
        }
      }
    }

    // Poll immediately on start (dengan delay kecil untuk tidak conflict dengan initial load)
    setTimeout(() => {
      poll()
    }, 1000)

    // Set interval
    pollingIntervalRef.current = setInterval(() => {
      poll()
    }, pollingInterval * 1000)
  }, [selectedOlt, pollingEnabled, pollingInterval, page, limit])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
      console.log(`[Polling] Stopped polling`)
    }
  }, [])

  // Handle polling start/stop
  // Polling berjalan untuk semua OLT (tidak perlu pilih OLT)
  useEffect(() => {
    if (pollingEnabled && olts.length > 0) {
      startPolling()
    } else {
      stopPolling()
    }

    return () => {
      stopPolling()
    }
  }, [pollingEnabled, olts.length, pollingInterval, startPolling, stopPolling])

  // Page Visibility API - pause polling saat tab tidak aktif
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden
      if (document.hidden) {
        console.log(`[Polling] Page hidden, pausing polling`)
      } else {
        console.log(`[Polling] Page visible, resuming polling`)
        // Resume polling jika enabled (tidak perlu selectedOlt)
        if (pollingEnabled && olts.length > 0) {
          startPolling()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pollingEnabled, olts.length, startPolling])

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
        setSummaryData(data.summary || INITIAL_SUMMARY)
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
          const newSummary = calculateSummary(updatedOnus)
          setSummaryData(newSummary)
          console.log(`[All-ONU] Refresh: Displaying live data from SNMP GET for ${updatedOnus.length} ONUs`)
        } else {
          // Fallback ke data database jika SNMP GET gagal
          console.warn(`[All-ONU] Refresh: SNMP GET failed, using database data as fallback`)
          setOnus(incomingOnus)
          setSummaryData(data.summary || INITIAL_SUMMARY)
        }
      } else {
        setOnus(incomingOnus)
        setSummaryData(data.summary || INITIAL_SUMMARY)
      }
      
      setPagination(data.pagination || { ...INITIAL_PAGINATION, limit })
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
      // Set flag pagination jika ini bukan initial load (sudah ada data sebelumnya)
      // Ini mencegah polling mengganggu saat user navigate pagination
      if (onus.length > 0) {
        isPaginationRef.current = true
      }
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
            {/* Polling Status */}
            {selectedOlt && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPollingEnabled(!pollingEnabled)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      pollingEnabled
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    title={pollingEnabled ? 'Klik untuk pause polling' : 'Klik untuk resume polling'}
                  >
                    <div className={`w-2 h-2 rounded-full ${pollingEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    {pollingEnabled ? 'Polling Aktif' : 'Polling Paused'}
                  </button>
                  {lastPollTime && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Terakhir: {lastPollTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
                
                {/* Polling Interval Selector */}
                {pollingEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Interval:</span>
                    <select
                      value={pollingInterval}
                      onChange={(e) => {
                        const newInterval = parseInt(e.target.value, 10)
                        setPollingInterval(newInterval)
                        // Restart polling dengan interval baru
                        stopPolling()
                        setTimeout(() => {
                          if (pollingEnabled && olts.length > 0) {
                            startPolling()
                          }
                        }, 100)
                      }}
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value={10}>10s</option>
                      <option value={30}>30s</option>
                      <option value={60}>1m</option>
                      <option value={120}>2m</option>
                      <option value={300}>5m</option>
                    </select>
                  </div>
                )}
              </>
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
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                  selectedOlt ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
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
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            selectedOlt === olt.id ? 'bg-blue-50 dark:bg-blue-900/20 font-medium' : ''
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
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                  !hasCardOptions || !selectedOlt
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
                  !selectedCard || !selectedOlt
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
                disabled={false}
                className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
                  !selectedOlt
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

          {/* Refresh Button */}
          <button 
            onClick={handleRefresh}
            disabled={!selectedOlt}
            className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
              !selectedOlt 
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
            className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors ${
              !selectedOlt 
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
              className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white ${
                !selectedOlt ? 'opacity-50 cursor-not-allowed' : ''
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
              className={`px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                !selectedOlt ? 'opacity-50 cursor-not-allowed' : ''
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-white">
                  Status OID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {loading ? (
                <tr key="loading">
                  <td colSpan={13} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <HiArrowPath className="w-5 h-5 animate-spin" />
                      Memuat data ONU...
                    </div>
                  </td>
                </tr>
              ) : onus.length === 0 ? (
                <tr key="empty">
                  <td colSpan={13} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada data ONU di database. Data akan tersedia setelah background scheduler sync (runs every 5 minutes). Klik &quot;Refresh&quot; untuk force fetch dari SNMP.
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
                      <div className="flex flex-col gap-1">
                        {onu.statusOid ? (
                          <div className="group relative">
                            <span className="text-xs font-mono text-gray-600 dark:text-gray-400 cursor-help" title={`Status: ${onu.statusOid}\nRX OLT: ${onu.rxOltOid || 'N/A'}\nRX ONU: ${onu.rxOnuOid || 'N/A'}\nName: ${onu.nameOid || 'N/A'}\nDesc: ${onu.descOid || 'N/A'}`}>
                              {onu.statusOid.length > 25 ? `${onu.statusOid.substring(0, 25)}...` : onu.statusOid}
                            </span>
                            <div className="absolute left-0 top-full mt-1 w-96 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible z-50 transition-all">
                              <div className="font-semibold mb-1">SNMP OIDs:</div>
                              <div className="space-y-1 font-mono">
                                <div><span className="text-blue-300">Status:</span> {onu.statusOid || 'N/A'}</div>
                                <div><span className="text-blue-300">RX OLT:</span> {onu.rxOltOid || 'N/A'}</div>
                                <div><span className="text-blue-300">RX ONU:</span> {onu.rxOnuOid || 'N/A'}</div>
                                <div><span className="text-blue-300">Name:</span> {onu.nameOid || 'N/A'}</div>
                                <div><span className="text-blue-300">Desc:</span> {onu.descOid || 'N/A'}</div>
                                {onu.compositeIndex && <div><span className="text-blue-300">Composite Index:</span> {onu.compositeIndex}</div>}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500" title="OID akan terisi setelah sync ONU dijalankan">
                            Belum sync
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleTestSnmpTable(onu)}
                          disabled={!onu.statusOid || !onu.compositeIndex}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!onu.statusOid || !onu.compositeIndex ? 'OID belum tersimpan, sync ONU terlebih dahulu' : 'Test SNMP TABLE'}
                        >
                          <HiOutlineTableCells className="w-4 h-4" />
                          Test Table
                        </button>
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
                isPaginationRef.current = true
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
                      isPaginationRef.current = true
                      setPage(num)
                    }}
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
              onClick={() => {
                isPaginationRef.current = true
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

      {/* Modal Test SNMP TABLE */}
      {testTableModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Test SNMP TABLE
                </h3>
                {selectedOnuForTest && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    ONU: {selectedOnuForTest.gponOnu} - {selectedOnuForTest.name}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setTestTableModalOpen(false)
                  setTestTableResult(null)
                  setTestTableError(null)
                  setSelectedOnuForTest(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <HiXMark className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {testTableLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <HiArrowPath className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Menguji SNMP TABLE...
                    </p>
                  </div>
                </div>
              ) : testTableError ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
                    <HiExclamationTriangle className="w-5 h-5" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                    {testTableError}
                  </p>
                </div>
              ) : testTableResult ? (
                <div className="space-y-4">
                  {/* Info */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Base OID:</span>
                        <p className="font-mono text-xs text-gray-600 dark:text-gray-400 mt-1 break-all">
                          {testTableResult.baseOid || 'N/A'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Columns:</span>
                        <p className="text-gray-600 dark:text-gray-400 mt-1 break-all">
                          {testTableResult.columns || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Composite Index:</span>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {testTableResult.onu?.compositeIndex || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">ONU ID:</span>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {testTableResult.onu?.onuId || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Total Results:</span>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {testTableResult.totalResults || 0}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Raw Total Results:</span>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {testTableResult.rawTotalResults || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Results Table */}
                  {testTableResult.results && Object.keys(testTableResult.results).length > 0 ? (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                Key (Column.Index)
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                Value
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {Object.entries(testTableResult.results).map(([key, value]) => (
                              <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                                  {key}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 break-all">
                                  {String(value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400">
                        <HiInformationCircle className="w-5 h-5" />
                        <span className="font-medium">Tidak ada data</span>
                      </div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                        SNMP TABLE tidak mengembalikan data untuk ONU ini.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => {
                  setTestTableModalOpen(false)
                  setTestTableResult(null)
                  setTestTableError(null)
                  setSelectedOnuForTest(null)
                }}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded hover:bg-gray-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

