import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session = await getServerSession(authConfig)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/opname/summary
 * Get stock opname summary per gudang
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    const gudangId = req.nextUrl.searchParams.get('gudangId')

    try {
      const dbStart = Date.now()

      const whereClause = gudangId ? { gudangId } : {}

      // Get all items with stock
      const barangGudangs = await prisma.barangGudang.findMany({
        where: whereClause,
        include: {
          barang: {
            select: {
              id: true,
              kode: true,
              nama: true,
              satuan: true
            }
          },
          gudang: {
            select: {
              id: true,
              kode: true,
              nama: true
            }
          }
        }
      })

      // Get latest opname for each item
      const latestOpnames = await prisma.stockOpname.groupBy({
        by: ['barangId', 'gudangId'],
        where: whereClause,
        _max: {
          tanggal: true
        }
      })

      // Build summary
      const summary = barangGudangs.map(bg => ({
        id: bg.id,
        barang: bg.barang,
        gudang: bg.gudang,
        stokSistem: bg.stok,
        lastOpname: latestOpnames.find(
          lo => lo.barangId === bg.barangId && lo.gudangId === bg.gudangId
        )?._max.tanggal
      }))

      logger.dbOperation('findMany+groupBy', 'BarangGudang+StockOpname', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/opname/summary', 200, Date.now() - startTime, {
        userId: session.user.id,
        count: summary.length,
        gudangId,
      })

      return NextResponse.json({ summary })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Error getting stock opname summary', err, {
      path: '/api/inventory/opname/summary',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data summary stock opname' },
      { status: 500 }
    )
  }
}