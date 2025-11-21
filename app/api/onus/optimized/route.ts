/**
 * Optimized ONU API endpoint dengan pagination dan caching
 * Untuk mengatasi performance issues saat data SNMP banyak
 * Support single OLT atau semua OLT
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchOnuDataPaginated } from '@/lib/services/snmp-optimized'
import { getOLTRepository } from '@/lib/repositories'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const ipAddress = searchParams.get('ip')
    const port = parseInt(searchParams.get('port') || '161')
    const community = searchParams.get('community') || 'public'
    const version = searchParams.get('version') || '2c'
    const oltId = searchParams.get('oltId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    // Jika tidak ada IP address, fetch dari semua connected OLTs
    if (!ipAddress) {
      console.log(`[ONU-Optimized] Fetching ONU data from all connected OLTs (page ${page}, pageSize ${pageSize})`)
      
      const oltRepo = getOLTRepository()
      const olts = await oltRepo.findAll()
      const connectedOlts = olts.filter(
        (olt) => olt.snmpConnected && olt.snmpCommunityWrite && olt.type?.toLowerCase().includes('c300')
      )

      if (connectedOlts.length === 0) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: {
            page: 1,
            pageSize,
            total: 0,
            totalPages: 0
          },
          message: 'No connected OLTs found'
        })
      }

      // Fetch data dari semua OLTs dan combine
      const allData: Array<{
        oltId: string
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
          const result = await fetchOnuDataPaginated(
            olt.ipAddress,
            olt.snmpPort,
            olt.snmpCommunityWrite,
            olt.snmpVersion || '2c',
            olt.id,
            1, // Fetch all pages untuk combine
            10000 // Large page size untuk get all
          )
          
          // Add OLT name to each ONU
          const onusWithOltName = result.data.map(onu => ({
            ...onu,
            oltName: olt.name
          }))
          
          allData.push(...onusWithOltName)
        } catch (error: any) {
          console.error(`[ONU-Optimized] Error fetching from OLT ${olt.name}:`, error)
          // Continue dengan OLT berikutnya
        }
      }

      // Apply pagination setelah combine semua data
      const total = allData.length
      const totalPages = Math.ceil(total / pageSize)
      const startIndex = (page - 1) * pageSize
      const endIndex = Math.min(startIndex + pageSize, total)
      const paginatedData = allData.slice(startIndex, endIndex)

      return NextResponse.json({
        success: true,
        data: paginatedData,
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        },
        message: `Successfully fetched ${paginatedData.length} ONUs from ${connectedOlts.length} OLT(s) (page ${page} of ${totalPages})`
      })
    }

    // Single OLT mode (existing behavior)
    console.log(`[ONU-Optimized] Fetching ONU data from ${ipAddress}:${port} (page ${page}, pageSize ${pageSize})`)

    const result = await fetchOnuDataPaginated(
      ipAddress,
      port,
      community,
      version,
      oltId,
      page,
      pageSize
    )

    return NextResponse.json({
      success: true,
      ...result,
      message: `Successfully fetched ${result.data.length} ONUs (page ${page} of ${result.pagination.totalPages})`
    })

  } catch (error: any) {
    console.error('[ONU-Optimized] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch ONU data'
    }, { status: 500 })
  }
}

// POST untuk clear cache
export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json()

    if (action === 'clear-cache') {
      const { clearSNMPCache } = await import('@/lib/services/snmp-optimized')
      clearSNMPCache()

      return NextResponse.json({
        success: true,
        message: 'SNMP cache cleared successfully'
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 })

  } catch (error: any) {
    console.error('[ONU-Optimized] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to perform action'
    }, { status: 500 })
  }
}