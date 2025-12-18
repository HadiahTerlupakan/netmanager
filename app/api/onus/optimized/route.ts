/**
 * Optimized ONU API endpoint dengan Redis caching dan pagination
 * Endpoint ini menggunakan:
 * - Redis caching untuk reduce DB load
 * - Pagination untuk reduce payload size
 * - Selective field projection untuk faster queries
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOnuRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'

import { verifyAuth } from '@/lib/auth'
export async function GET(req: NextRequest) {
  try {
    // Authentication check
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url)

    // Pagination parameters
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50'), 1), 100) // Max 100 per page

    // Filter parameters
    const oltId = searchParams.get('oltId') || undefined
    const status = searchParams.get('status') || undefined
    const search = searchParams.get('search') || undefined
    const useCache = searchParams.get('cache') !== 'false' // Cache enabled by default

    logger.info(`Optimized ONU list request`, {
      page,
      limit,
      oltId: oltId || 'all',
      status: status || 'all',
      search: search || 'none',
      useCache,
    })

    const onuRepo = getOnuRepository()

    // Use the new optimized paginated method with caching
    const result = await onuRepo.findPaginatedOptimized({
      oltId,
      page,
      limit,
      status,
      search,
      useCache,
    })

    logger.info(`Optimized ONU list response`, {
      page: result.page,
      total: result.total,
      returned: result.onus.length,
      totalPages: result.totalPages,
    })

    return NextResponse.json({
      success: true,
      data: result.onus,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    })

  } catch (error: any) {
    logger.error('Optimized ONU list error', error instanceof Error ? error : new Error(String(error)))

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch ONU data',
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      },
    }, { status: 500 })
  }
}


// POST untuk clear cache
export async function POST(req: NextRequest) {
  try {
    // Authentication check
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json()

    if (action === 'clear-cache') {
      const { clearSNMPCache } = await import('@/modules/network/services/snmp-optimized')
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