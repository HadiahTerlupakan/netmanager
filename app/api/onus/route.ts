import { NextRequest, NextResponse } from 'next/server'
import { getOLTRepository, getOnuRepository } from '@/lib/repositories'
import { getC300GponOnuDataViaSNMP } from '../onus/sync/route'
// Import ini akan memastikan global error handler untuk net-snmp ter-load

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    
    // Get pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const search = searchParams.get('search') || ''
    
    // Get filters
    const oltId = searchParams.get('oltId') || null
    const card = searchParams.get('card') || null // Format: "Frame/Slot"
    const port = searchParams.get('port') || null // Format: "Frame/Slot/Port"
    const type = searchParams.get('type') || null

    // Fetch langsung dari SNMP tanpa database
    const oltRepo = getOLTRepository()
    const olts = await oltRepo.findAll()
    const connectedOlts = olts.filter(
      (olt) => olt.snmpConnected && olt.snmpCommunityWrite && olt.type?.toLowerCase().includes('c300')
    )

    if (connectedOlts.length === 0) {
      return NextResponse.json({
        onus: [],
        pagination: {
          page: 1,
          limit,
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
      })
    }

    // Fetch ONU data langsung dari SNMP untuk semua OLT
    // Simpan data sebelum filter untuk types extraction
    let allOnusBeforeFilters: Array<{
      id?: string
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

    for (const olt of connectedOlts) {
      try {
        const onuData = await getC300GponOnuDataViaSNMP(
          olt.ipAddress,
          olt.snmpPort,
          olt.snmpCommunityWrite,
          olt.snmpVersion,
          olt.id
        )

        // Tambahkan OLT name dan ID unik ke setiap ONU
        // Gunakan index dari loop untuk memastikan ID unik
        const onusWithOltName = onuData.map((onu, index) => ({
          ...onu,
          // ID unik: oltId-index-gponOnu (index memastikan unik meskipun gponOnu sama)
          id: `${olt.id}-${index}-${onu.gponOnu}`,
          oltName: olt.name,
        }))

        allOnusBeforeFilters = [...allOnusBeforeFilters, ...onusWithOltName]
      } catch (error: any) {
        console.error(`[All-ONU] Error fetching ONUs from OLT ${olt.name}:`, error)
        // Continue dengan OLT berikutnya, jangan throw error
        // Data dari OLT lain masih bisa ditampilkan
      }
    }
    
    // Start with all data, then apply filters
    let allOnus = [...allOnusBeforeFilters]

    // Apply filters
    // Filter by OLT
    if (oltId) {
      allOnus = allOnus.filter((onu) => onu.oltId === oltId)
    }
    
    // Filter by Card (Frame/Slot)
    if (card) {
      const [frame, slot] = card.split('/').map(Number)
      allOnus = allOnus.filter((onu) => {
        const match = onu.gponOnu.match(/^(\d+)\/(\d+)\/(\d+):/)
        if (match) {
          const onuFrame = parseInt(match[1], 10)
          const onuSlot = parseInt(match[2], 10)
          return onuFrame === frame && onuSlot === slot
        }
        return false
      })
    }
    
    // Filter by Port (Frame/Slot/Port)
    if (port) {
      const [frame, slot, portNum] = port.split('/').map(Number)
      allOnus = allOnus.filter((onu) => {
        const match = onu.gponOnu.match(/^(\d+)\/(\d+)\/(\d+):/)
        if (match) {
          const onuFrame = parseInt(match[1], 10)
          const onuSlot = parseInt(match[2], 10)
          const onuPort = parseInt(match[3], 10)
          return onuFrame === frame && onuSlot === slot && onuPort === portNum
        }
        return false
      })
    }
    
    // Filter by Type
    if (type) {
      allOnus = allOnus.filter((onu) => onu.actualType === type)
    }
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      allOnus = allOnus.filter(
        (onu) =>
          onu.name?.toLowerCase().includes(searchLower) ||
          onu.gponOnu?.toLowerCase().includes(searchLower) ||
          onu.serialNumber?.toLowerCase().includes(searchLower) ||
          onu.oltName?.toLowerCase().includes(searchLower) ||
          onu.description?.toLowerCase().includes(searchLower)
      )
    }

    // Calculate summary statistics
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

    allOnus.forEach((onu) => {
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

    const total = allOnus.length
    const goodPercentage = total > 0 ? ((goodCount / total) * 100).toFixed(1) : '0'
    const warningPercentage = total > 0 ? ((warningCount / total) * 100).toFixed(1) : '0'
    const criticalPercentage = total > 0 ? ((criticalCount / total) * 100).toFixed(1) : '0'
    const otherPercentage = total > 0 ? ((otherCount / total) * 100).toFixed(1) : '0'

    // Extract unique types for dropdown (from all data before filters)
    const typeMap = new Map<string, number>()
    allOnusBeforeFilters.forEach((onu) => {
      if (onu.actualType) {
        const count = typeMap.get(onu.actualType) || 0
        typeMap.set(onu.actualType, count + 1)
      }
    })
    const typesArray = Array.from(typeMap.keys()).sort()
    const typeCountsObj: Record<string, number> = {}
    typeMap.forEach((count, type) => {
      typeCountsObj[type] = count
    })

    // Apply pagination
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedOnus = allOnus.slice(startIndex, endIndex).map((onu) => ({
      ...onu,
      id: onu.id || `${onu.oltId}-${onu.gponOnu}`, // Pastikan setiap ONU punya ID unik
    }))
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      onus: paginatedOnus,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      summary: {
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
      },
      // Include types and counts for dropdown (from all data before filters)
      types: typesArray,
      typeCounts: typeCountsObj,
      // Include total count for "All Types" (before any filters)
      totalOnus: allOnusBeforeFilters.length,
    })
  } catch (error: any) {
    console.error('Error fetching ONUs:', error)
    // Return empty data instead of error, agar UI tetap bisa render
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
    })
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

