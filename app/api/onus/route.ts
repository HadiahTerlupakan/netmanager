import { NextRequest, NextResponse } from 'next/server'
import { getOLTRepository, getOnuRepository } from '@/lib/repositories'

import { verifyAuth } from '@/lib/auth'
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
const CACHE_TTL = 120000 // 2 menit untuk data ONU (lebih lama untuk stabilitas)
const AGGREGATE_CACHE_TTL = 300000 // 5 menit untuk agregat (summary/types/cards)

// Export function untuk clear cache (dipanggil saat data di-sync)
export function clearOnuCache(): void {
  const count = cache.size
  const aggregateCount = aggregateCache.size
  cache.clear()
  aggregateCache.clear()
  console.log(`[All-ONU] Cleared all ONU cache (${count} data entries, ${aggregateCount} aggregate entries)`)
}

type CardSummary = {
  frame: number
  card: number
  slots: Array<{ slot: number; ports: number[] }>
  totalSlots: number
  totalPorts: number
}

// Helper function untuk parse gponOnu dengan pattern yang konsisten
// Format: Frame/Slot/Port:OnuID atau Frame/Slot/Port
function parseGponOnu(gponOnu: string): { frame: number; slot: number; port: number; onu: number | null } | null {
  if (!gponOnu) return null
  // Support kedua format: dengan atau tanpa :OnuID
  const match = gponOnu.match(/^(\d+)\/(\d+)\/(\d+)(?::(\d+))?$/)
  if (!match) return null
  
  return {
    frame: parseInt(match[1], 10),
    slot: parseInt(match[2], 10),
    port: parseInt(match[3], 10),
    onu: match[4] ? parseInt(match[4], 10) : null
  }
}

function extractCardsFromOnuData(
  onus: Array<{ gponOnu: string }>
): CardSummary[] {
  const cardMap = new Map<number, Map<number, Set<number>>>()

  onus.forEach((onu) => {
    if (!onu.gponOnu) return
    const parsed = parseGponOnu(onu.gponOnu)
    if (!parsed) return

    const frame = parsed.frame
    const slot = parsed.slot
    const port = parsed.port

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
        // Authentication check
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
    
    // Log request untuk debugging
    console.log(`[All-ONU] Request received: oltId=${oltId || 'ALL'}, page=${page}, limit=${limit}, card=${card || 'ALL'}, port=${port || 'ALL'}, type=${type || 'ALL'}, forceRefresh=${forceRefresh}`)

    // Cache key yang konsisten: selalu gunakan key untuk SEMUA data (tanpa filter)
    // Filter akan dilakukan setelah fetch, bukan sebelum
    // Ini memastikan data selalu konsisten dan tidak berbeda-beda
    const baseCacheKey = 'onu:all:all:all:all:' // Key konsisten untuk semua data
    const aggregateCacheKey = 'aggregate:all:all:all:all'
    
    // Check cache untuk base data (semua data, tanpa filter)
    // Skip cache jika forceRefresh=true (untuk refresh manual)
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
    let fromDatabase = false
    
    // Prioritas 1: Gunakan cache jika tersedia dan tidak force refresh
    if (cachedEntry && !forceRefresh) {
      console.log(`[All-ONU] Using cached data (${cachedEntry.data.length} ONUs, age: ${Math.round((Date.now() - cachedEntry.timestamp) / 1000)}s)`)
      allOnuData = cachedEntry.data
      fromCache = true
    } else {
      // Prioritas 2: Ambil dari database (lebih cepat dari SNMP)
      // Hanya fetch dari SNMP jika forceRefresh=true atau data tidak ada di database
      const onuRepo = getOnuRepository()
      const oltRepo = getOLTRepository()
      
      // HANYA ambil dari database (yang sudah di-sync dari menu OLT)
      // Jangan fetch langsung dari SNMP - biarkan menu OLT yang handle sync
      // SELALU ambil SEMUA data dari database untuk konsistensi cache
      // Filter akan dilakukan setelah fetch, bukan sebelum
      console.log(`[All-ONU] Fetching ALL ONU data from database (for consistent caching)...`)
      
      try {
        // SELALU ambil SEMUA data ONU dari database (semua OLT)
        // Ini memastikan cache selalu konsisten dan tidak berbeda-beda
        const allOnusInDb = await onuRepo.findAll()
        console.log(`[All-ONU] Fetched ${allOnusInDb.length} ONUs from database (sorted by oltId, gponOnu)`)
        
        if (allOnusInDb.length > 0) {
          // Get OLT names untuk mapping
          const allOlts = await oltRepo.findAll()
          const oltNameMap = new Map<string, string>()
          allOlts.forEach(olt => {
            oltNameMap.set(olt.id, olt.name)
          })
          
          // Convert semua data ONU
          const convertedData = allOnusInDb.map(onu => ({
            id: onu.gponOnu,
            oltId: onu.oltId,
            oltName: oltNameMap.get(onu.oltId) || `OLT ${onu.oltId}`, // Use OLT name if available, otherwise fallback
            name: onu.name,
            description: onu.description,
            pppoe: onu.pppoe,
            gponOnu: onu.gponOnu,
            status: onu.status,
            rxOlt: onu.rxOlt,
            rxOnu: onu.rxOnu,
            serialNumber: onu.serialNumber,
            actualType: onu.actualType,
            // SNMP OID fields
            statusOid: onu.statusOid || null,
            rxOltOid: onu.rxOltOid || null,
            rxOnuOid: onu.rxOnuOid || null,
            nameOid: onu.nameOid || null,
            descOid: onu.descOid || null,
            compositeIndex: onu.compositeIndex || null,
          }))
          
          allOnuData.push(...convertedData)
          fromDatabase = true
          
          const oltIdsInDb = new Set(allOnusInDb.map(onu => onu.oltId))
          console.log(`[All-ONU] Loaded ${allOnuData.length} ONUs from database untuk ${oltIdsInDb.size} OLT ID(s): ${Array.from(oltIdsInDb).join(', ')}`)
        } else {
          console.log(`[All-ONU] No ONU data in database`)
        }

        // Cache hasil jika ada data (selalu cache semua data, tanpa filter)
        // Ini memastikan data konsisten untuk semua request berikutnya
        if (allOnuData.length > 0) {
          cache.set(baseCacheKey, {
            data: allOnuData,
            timestamp: Date.now()
          })
          console.log(`[All-ONU] Cached ${allOnuData.length} ONUs from database (all OLTs, no filters) for ${CACHE_TTL / 1000}s`)
        }
        
        // Hapus logika lama yang kompleks - sekarang lebih sederhana
        // Jika oltId ada, hanya ambil data untuk OLT tersebut
        // Jika tidak, ambil semua data dari database
      } catch (error: any) {
        console.error(`[All-ONU] Error fetching from database:`, error.message)
      }
      
      // Hapus logika fetch dari SNMP - biarkan menu OLT yang handle sync
      // Data akan tersedia setelah sync dari menu OLT
      // Jika forceRefresh=true, tetap hanya ambil dari database (tidak fetch dari SNMP)
      // User harus sync dari menu OLT terlebih dahulu
    }

    // Filter berdasarkan oltId (jika sudah di-filter di atas, ini akan tetap sama)
    // Tapi tetap perlu filter di sini untuk memastikan konsistensi
    let filteredOnus = allOnuData

    if (oltId) {
      filteredOnus = filteredOnus.filter(onu => onu.oltId === oltId)
    }

    if (card) {
      filteredOnus = filteredOnus.filter(onu => {
        const parsed = parseGponOnu(onu.gponOnu)
        if (!parsed) return false
        const cardKey = `${parsed.frame}/${parsed.slot}`
        return cardKey === card
      })
    }

    if (port) {
      filteredOnus = filteredOnus.filter(onu => {
        const parsed = parseGponOnu(onu.gponOnu)
        if (!parsed) return false
        const portKey = `${parsed.frame}/${parsed.slot}/${parsed.port}`
        return portKey === port
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
    // Gunakan sorting yang sama dengan database untuk konsistensi
    filteredOnus.sort((a, b) => {
      // Sort by OLT ID first (lebih stabil daripada name)
      if (a.oltId !== b.oltId) {
        return a.oltId.localeCompare(b.oltId)
      }
      // Then sort by GPON ONU (format: card/port/onu)
      // Gunakan helper function yang sama untuk konsistensi
      const aGpon = parseGponOnu(a.gponOnu)
      const bGpon = parseGponOnu(b.gponOnu)
      
      if (!aGpon || !bGpon) {
        // Jika salah satu tidak bisa di-parse, sort berdasarkan string
        return (a.gponOnu || '').localeCompare(b.gponOnu || '')
      }
      
      if (aGpon.frame !== bGpon.frame) return aGpon.frame - bGpon.frame
      if (aGpon.slot !== bGpon.slot) return aGpon.slot - bGpon.slot
      if (aGpon.port !== bGpon.port) return aGpon.port - bGpon.port
      // Handle onu yang mungkin null
      const aOnu = aGpon.onu ?? 0
      const bOnu = bGpon.onu ?? 0
      return aOnu - bOnu
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

    // Hitung total dari filteredOnus (untuk filter yang aktif)
    // Ini memastikan pagination dan summary sesuai dengan data yang benar-benar ada setelah filtering
    const total = filteredOnus.length
    
    if (cachedAggregate && !forceRefresh) {
      // Gunakan cached aggregate hanya untuk types, cards, dan totalOnus (untuk dropdown/filter)
      // Tapi summary harus dihitung dari filteredOnus untuk akurasi
      console.log(`[All-ONU] Using cached aggregate data for types/cards (age: ${Math.round((Date.now() - cachedAggregate.timestamp) / 1000)}s)`)
      typesArray = cachedAggregate.types
      typeCountsObj = cachedAggregate.typeCounts
      cardsSummary = cachedAggregate.cards
      totalOnusCount = cachedAggregate.totalOnus
      
      // Hitung summary dari filteredOnus (bukan dari cache)
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
    } else {
      // Hitung semua dari filteredOnus
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

    // Pagination - selalu gunakan startIndex dari page untuk pagination tradisional
    // total sudah dihitung dari filteredOnus.length di atas
    const startIndex = (page - 1) * limit
    const endIndex = Math.min(startIndex + limit, total)
    const paginatedOnus = filteredOnus.slice(startIndex, endIndex)
    const totalPages = Math.ceil(total / limit)
    
    // Log untuk debugging perubahan jumlah data
    console.log(`[All-ONU] Pagination: page=${page}, limit=${limit}, total=${total}, filtered=${filteredOnus.length}, paginated=${paginatedOnus.length}, totalPages=${totalPages}`)
    // nextCursor untuk tracking, tapi tidak digunakan untuk pagination
    const nextCursor = endIndex < total ? endIndex : null
    const currentPage = page

    // Calculate cache age untuk logging
    const cacheAge = cachedEntry ? Math.round((Date.now() - cachedEntry.timestamp) / 1000) : null

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
      fromDatabase, // Flag untuk menandai apakah data dari database (bukan SNMP)
      cacheAge, // Umur cache dalam detik (untuk debugging)
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
        // Authentication check
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
