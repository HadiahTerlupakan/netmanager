import { NextRequest, NextResponse } from 'next/server'
import { getOnuRepository } from '@/lib/repositories'

import { verifyAuth } from '@/lib/auth'
/**
 * API endpoint untuk mengambil data ONU dari database (bukan dari SNMP langsung)
 * Digunakan untuk melihat data yang sudah tersimpan di database
 */
export async function GET(req: NextRequest) {
  try {
        // Authentication check
        const user = await verifyAuth(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

    const searchParams = req.nextUrl.searchParams
    const oltId = searchParams.get('oltId')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const page = parseInt(searchParams.get('page') || '1', 10)
    
    if (!oltId) {
      return NextResponse.json(
        { error: 'oltId is required' },
        { status: 400 }
      )
    }

    const onuRepo = getOnuRepository()
    
    // Ambil data ONU dari database menggunakan repository
    const filters = {
      oltId,
    }
    
    const pagination = {
      page,
      limit,
    }
    
    const result = await onuRepo.findWithFilters(filters, pagination)
    
    return NextResponse.json({
      success: true,
      onus: result.onus,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    })
  } catch (error: any) {
    console.error('Error fetching ONUs from database:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil data ONU dari database' },
      { status: 500 }
    )
  }
}

