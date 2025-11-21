import { NextRequest, NextResponse } from 'next/server'
import { getOLTRepository, getOnuRepository } from '@/lib/repositories'
import { getC300GponOnuDataViaSNMP } from '../onus/sync/route'

// Simple in-memory cache untuk ONU data
// Cache key: kombinasi filter parameters
// Cache TTL: 30 detik (data tetap fresh tapi tidak fetch ulang setiap pagination)
interface CacheEntry {
  data: Array<{
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
  }>
  timestamp: number
}

interface AggregateCacheEntry {
  summary: any
  types: string[]
  typeCounts: Record<string, number>
  cards: CardSummary[]
  totalOnus: number
  timestamp: number
}

const cache = new Map<string, CacheEntry>()
const aggregateCache = new Map<string, AggregateCacheEntry>()
const CACHE_TTL = 30000 // 30 detik untuk data ONU
const AGGREGATE_CACHE_TTL = 300000 // 5 menit untuk agregat (summary/types/cards)

type CardSummary = {
  frame: number
  card: number
  slots: Array<{ slot: number; ports: number[] }>
  totalSlots: number
  totalPorts: number
}

function extractCardsFromOnuData(
  onus: Array<{ gponOnu: string }>
): CardSummary[] {
  const cardMap = new Map<number, Map<number, Set<number>>>()

  onus.forEach((onu) => {
    if (!onu.gponOnu) return
    const match = onu.gponOnu.match(/^(\d+)\/(\d+)\/(\d+)(?::\d+)?$/)
    if (!match) return

    const frame = parseInt(match[1], 10)
    const slot = parseInt(match[2], 10)
    const port = parseInt(match[3], 10)

    if (!cardMap.has(frame)) {
      cardMap.set(frame, new Map())
    }

    const slotMap = cardMap.get(frame)!
    if (!slotMap.has(slot)) {
      slotMap.set(slot, new Set())
    }
    slotMap.get(slot)!.add(port)
  })

  return Array.from(cardMap.entries())
    .map(([frame, slotMap]) => {
      const slots = Array.from(slotMap.entries())
        .map(([slot, ports]) => ({
          slot,
          ports: Array.from(ports).sort((a, b) => a - b),
        }))
        .sort((a, b) => a.slot - b.slot)

      return {
        frame,
        card: frame,
        slots,
        totalSlots: slots.length,
        totalPorts: slots.reduce((sum, slot) => sum + slot.ports.length, 0),
      }
    })
    .sort((a, b) => a.frame - b.frame)
}

function getCacheKey(oltId: string | null, card: string | null, port: string | null, type: string | null, search: string): string {
  return `onu:${oltId || 'all'}:${card || 'all'}:${port || 'all'}:${type || 'all'}:${search || ''}`
}

function getCachedData(key: string): CacheEntry | null {
  const entry = cache.get(key)
  if (!entry) return null
  
  const now = Date.now()
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  
  return entry
}

function getCachedAggregate(key: string): AggregateCacheEntry | null {
  const entry = aggregateCache.get(key)
  if (!entry) return null
  
  const now = Date.now()
  if (now - entry.timestamp > AGGREGATE_CACHE_TTL) {
    aggregateCache.delete(key)
    return null
  }
  
  return entry
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const pageParam = parseInt(searchParams.get('page') || '1', 10)
    const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
    const search = searchParams.get('search') || ''
    const oltId = searchParams.get('oltId') || null
    const card = searchParams.get('card') || null
    const port = searchParams.get('port') || null
    const type = searchParams.get('type') || null
    const forceRefresh = searchParams.get('forceRefresh') === 'true'
    const cursorParam = searchParams.get('cursor')
    const cursor = cursorParam !== null ? Math.max(parseInt(cursorParam, 10) || 0, 0) : null

    // Check cache untuk base data (tanpa filter search, karena search dilakukan setelah fetch)
    // Cache key berdasarkan OLT/Card/Port/Type (tanpa search, karena search adalah client-side filter)
    // Skip cache jika forceRefresh=true (untuk halaman terakhir atau refresh manual)
    const baseCacheKey = getCacheKey(oltId, card, port, type, '')
    const aggregateCacheKey = `aggregate:${oltId || 'all'}:${card || 'all'}:${port || 'all'}:${type || 'all'}`
    
    // Check cache untuk agregat terlebih dahulu (TTL lebih panjang)
    const cachedAggregate = forceRefresh ? null : getCachedAggregate(aggregateCacheKey)
    const cachedEntry = forceRefresh ? null : getCachedData(baseCacheKey)
    
    let allOnuData: Array<{
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
    }> = []

    let fromCache = false
    if (cachedEntry && !forceRefresh) {
      console.log(`[All-ONU] Using cached data (${cachedEntry.data.length} ONUs, age: ${Math.round((Date.now() - cachedEntry.timestamp) / 1000)}s)`)
      allOnuData = cachedEntry.data
      fromCache = true
    } else {
      if (forceRefresh) {
        console.log(`[All-ONU] Force refresh requested, skipping cache and fetching fresh data from SNMP...`)
      } else {
        console.log(`[All-ONU] Fetching ONU data directly from SNMP...`)
      }
      console.log(`[All-ONU] Fetching ONU data directly from SNMP...`)
      
      const oltRepo = getOLTRepository()
      const allOlts = await oltRepo.findAll()
      const targetOlts = oltId 
        ? allOlts.filter(olt => olt.id === oltId && olt.snmpConnected && olt.snmpCommunityWrite && olt.type?.toLowerCase().includes('c300'))
        : allOlts.filter(olt => olt.snmpConnected && olt.snmpCommunityWrite && olt.type?.toLowerCase().includes('c300'))

      if (targetOlts.length === 0) {
        return NextResponse.json({
          onus: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
          summary: {
            total: 0,
            good: { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 },
            warning: { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 },
            critical: { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 },
            other: { count: 0, percentage: '0', los: 0, na: 0 },
          },
          types: [],
          typeCounts: {},
          totalOnus: 0,
        })
      }

      for (const olt of targetOlts) {
        try {
          const onuData = await getC300GponOnuDataViaSNMP(
            olt.ipAddress,
            olt.snmpPort || 161,
            olt.snmpCommunityWrite!,
            olt.snmpVersion || '2c',
            olt.id
          )

          const convertedData = onuData.map(onu => ({
            id: onu.gponOnu,
            oltId: onu.oltId,
            oltName: olt.name,
            name: onu.name,
            description: onu.description,
            pppoe: onu.pppoe,
            gponOnu: onu.gponOnu,
            status: onu.status,
            rxOlt: onu.rxOlt,
            rxOnu: onu.rxOnu,
            serialNumber: onu.serialNumber,
            actualType: onu.actualType
          }))

          allOnuData.push(...convertedData)
        } catch (error: any) {
          console.error(`[All-ONU] Error fetching ONU data from OLT ${olt.name}:`, error.message)
        }
      }

      // Cache hasil fetch (tanpa filter search)
      cache.set(baseCacheKey, {
        data: allOnuData,
        timestamp: Date.now()
      })
      console.log(`[All-ONU] Cached ${allOnuData.length} ONUs for ${CACHE_TTL / 1000}s`)
    }

    let filteredOnus = allOnuData

    if (oltId) {
      filteredOnus = filteredOnus.filter(onu => onu.oltId === oltId)
    }

    if (card) {
      filteredOnus = filteredOnus.filter(onu => {
        const match = onu.gponOnu.match(/^(\d+)\/(\d+)\/(\d+):(\d+)$/)
        if (match) {
          const cardKey = `${match[1]}/${match[2]}`
          return cardKey === card
        }
        return false
      })
    }

    if (port) {
      filteredOnus = filteredOnus.filter(onu => {
        const match = onu.gponOnu.match(/^(\d+)\/(\d+)\/(\d+):(\d+)$/)
        if (match) {
          const portKey = `${match[1]}/${match[2]}/${match[3]}`
          return portKey === port
        }
        return false
      })
    }

    if (type) {
      filteredOnus = filteredOnus.filter(onu => onu.actualType === type)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filteredOnus = filteredOnus.filter(onu =>
        onu.name?.toLowerCase().includes(searchLower) ||
        onu.description?.toLowerCase().includes(searchLower) ||
        onu.gponOnu?.toLowerCase().includes(searchLower) ||
        onu.pppoe?.toLowerCase().includes(searchLower) ||
        onu.serialNumber?.toLowerCase().includes(searchLower)
      )
    }

    // Sort data secara konsisten untuk memastikan pagination stabil
    // Sort berdasarkan: OLT Name -> GPON ONU (card/port/onu)
    filteredOnus.sort((a, b) => {
      // Sort by OLT name first
      if (a.oltName !== b.oltName) {
        return (a.oltName || '').localeCompare(b.oltName || '')
      }
      // Then sort by GPON ONU (format: card/port/onu)
      const parseGpon = (gpon: string) => {
        const match = gpon.match(/^(\d+)\/(\d+)\/(\d+):(\d+)$/)
        if (match) {
          return {
            card: parseInt(match[1]),
            slot: parseInt(match[2]),
            port: parseInt(match[3]),
            onu: parseInt(match[4])
          }
        }
        return { card: 0, slot: 0, port: 0, onu: 0 }
      }
      const aGpon = parseGpon(a.gponOnu)
      const bGpon = parseGpon(b.gponOnu)
      
      if (aGpon.card !== bGpon.card) return aGpon.card - bGpon.card
      if (aGpon.slot !== bGpon.slot) return aGpon.slot - bGpon.slot
      if (aGpon.port !== bGpon.port) return aGpon.port - bGpon.port
      return aGpon.onu - bGpon.onu
    })

    let goodCount = 0
    let warningCount = 0
    let criticalCount = 0
    let otherCount = 0
    let goodRxOlt = 0
    let goodRxOnu = 0
    let warningRxOlt = 0
    let warningRxOnu = 0
    let criticalRxOlt = 0
    let criticalRxOnu = 0
    let losCount = 0
    let naCount = 0

    filteredOnus.forEach((onu) => {
      const rxOlt = onu.rxOlt ? parseFloat(onu.rxOlt.replace(/[^\d.-]/g, '')) : null
      const rxOnu = onu.rxOnu ? parseFloat(onu.rxOnu.replace(/[^\d.-]/g, '')) : null

      if (rxOlt !== null && rxOlt >= -26.0) {
        goodCount++
        goodRxOlt++
        if (rxOnu !== null) goodRxOnu++
      } else if (rxOlt !== null && rxOlt >= -28.0 && rxOlt < -26.0) {
        warningCount++
        warningRxOlt++
        if (rxOnu !== null) warningRxOnu++
      } else if (rxOlt !== null && rxOlt < -28.0) {
        criticalCount++
        criticalRxOlt++
        if (rxOnu !== null) criticalRxOnu++
      } else {
        otherCount++
        if (onu.status === 'LOS') losCount++
        else naCount++
      }
    })

    // Gunakan cache agregat jika tersedia, atau hitung dari allOnuData
    let summaryData: any
    let typesArray: string[]
    let typeCountsObj: Record<string, number>
    let cardsSummary: CardSummary[]
    let totalOnusCount: number

    if (cachedAggregate && !forceRefresh) {
      console.log(`[All-ONU] Using cached aggregate data (age: ${Math.round((Date.now() - cachedAggregate.timestamp) / 1000)}s)`)
      summaryData = cachedAggregate.summary
      typesArray = cachedAggregate.types
      typeCountsObj = cachedAggregate.typeCounts
      cardsSummary = cachedAggregate.cards
      totalOnusCount = cachedAggregate.totalOnus
    } else {
      // Hitung summary dari filteredOnus (untuk filter yang aktif)
      const total = filteredOnus.length
      const goodPercentage = total > 0 ? ((goodCount / total) * 100).toFixed(1) : '0'
      const warningPercentage = total > 0 ? ((warningCount / total) * 100).toFixed(1) : '0'
      const criticalPercentage = total > 0 ? ((criticalCount / total) * 100).toFixed(1) : '0'
      const otherPercentage = total > 0 ? ((otherCount / total) * 100).toFixed(1) : '0'

      summaryData = {
        total,
        good: {
          count: goodCount,
          percentage: goodPercentage,
          rxOlt: goodRxOlt,
          rxOnu: goodRxOnu,
        },
        warning: {
          count: warningCount,
          percentage: warningPercentage,
          rxOlt: warningRxOlt,
          rxOnu: warningRxOnu,
        },
        critical: {
          count: criticalCount,
          percentage: criticalPercentage,
          rxOlt: criticalRxOlt,
          rxOnu: criticalRxOnu,
        },
        other: {
          count: otherCount,
          percentage: otherPercentage,
          los: losCount,
          na: naCount,
        },
      }

      // Extract unique types for dropdown dari allOnuData (semua data, bukan filtered)
      const typeMap = new Map<string, number>()
      allOnuData.forEach((onu) => {
        if (onu.actualType) {
          const count = typeMap.get(onu.actualType) || 0
          typeMap.set(onu.actualType, count + 1)
        }
      })
      typesArray = Array.from(typeMap.keys()).sort()
      typeCountsObj = {}
      typeMap.forEach((count, type) => {
        typeCountsObj[type] = count
      })

      cardsSummary = extractCardsFromOnuData(allOnuData)
      totalOnusCount = allOnuData.length

      // Cache agregat untuk penggunaan berikutnya (TTL lebih panjang)
      aggregateCache.set(aggregateCacheKey, {
        summary: summaryData,
        types: typesArray,
        typeCounts: typeCountsObj,
        cards: cardsSummary,
        totalOnus: totalOnusCount,
        timestamp: Date.now()
      })
      console.log(`[All-ONU] Cached aggregate data for ${AGGREGATE_CACHE_TTL / 1000}s`)
    }

    const total = summaryData.total

    // Pagination - selalu gunakan startIndex dari page untuk pagination tradisional
    const startIndex = (page - 1) * limit
    const endIndex = Math.min(startIndex + limit, total)
    const paginatedOnus = filteredOnus.slice(startIndex, endIndex)
    const totalPages = Math.ceil(total / limit)
    // nextCursor untuk tracking, tapi tidak digunakan untuk pagination
    const nextCursor = endIndex < total ? endIndex : null
    const currentPage = page

    return NextResponse.json({
      onus: paginatedOnus,
      pagination: {
        page: currentPage,
        limit,
        total,
        totalPages,
      },
      summary: summaryData,
      types: typesArray,
      typeCounts: typeCountsObj,
      totalOnus: totalOnusCount,
      nextCursor,
      cards: cardsSummary,
      fromCache, // Flag untuk menandai apakah data dari cache
    })
  } catch (error: any) {
    console.error('Error fetching ONUs:', error)
    return NextResponse.json({
      onus: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
      summary: {
        total: 0,
        good: { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 },
        warning: { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 },
        critical: { count: 0, percentage: '0', rxOlt: 0, rxOnu: 0 },
        other: { count: 0, percentage: '0', los: 0, na: 0 },
      },
      error: error.message || 'Gagal mengambil data ONU',
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const oltId = searchParams.get('oltId')
    
    const onuRepo = getOnuRepository()
    
    if (oltId) {
      // Hapus ONU dari OLT tertentu
      await onuRepo.deleteByOltId(oltId)
      const count = await onuRepo.countByOltId(oltId)
      
      return NextResponse.json({
        success: true,
        message: `Berhasil menghapus semua ONU dari OLT`,
        deleted: true,
        remaining: count,
      })
    } else {
      // Hapus semua ONU
      const allOnus = await onuRepo.findAll()
      const totalCount = allOnus.length
      
      // Hapus semua ONU
      for (const onu of allOnus) {
        await onuRepo.delete(onu.id)
      }
      
      return NextResponse.json({
        success: true,
        message: `Berhasil menghapus ${totalCount} ONU`,
        deleted: totalCount,
      })
    }
  } catch (error: any) {
    console.error('Error deleting ONUs:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus data ONU' },
      { status: 500 }
    )
  }
}
