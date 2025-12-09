import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireAuth() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || !['ADMIN', 'EMPLOYEE'].includes(session?.user?.role)) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/barang/stock/by-kondisi
 * Get stock breakdown by condition for specific barang and gudang
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAuth()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/barang/stock/by-kondisi')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')

    if (!barangId || !gudangId) {
      return NextResponse.json(
        { error: 'Barang ID dan Gudang ID harus diisi' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()

      // Get stock breakdown by condition from BarangMasuk and BarangKeluar
      const stockByKondisi = await prisma.barangMasuk.groupBy({
        by: ['kondisi'],
        where: {
          barangId,
          gudangId
        },
        _sum: {
          jumlah: true
        }
      })

      const stockKeluarByKondisi = await prisma.barangKeluar.groupBy({
        by: ['kondisi'],
        where: {
          barangId,
          gudangId,
          isHilang: false
        },
        _sum: {
          jumlah: true
        }
      })

      // Calculate current stock per kondisi
      const stockPerKondisi = {
        BARU: 0,
        BEKAS: 0,
        RUSAK: 0
      }

      // Add stock in
      stockByKondisi.forEach(item => {
        if (item.kondisi in stockPerKondisi) {
          stockPerKondisi[item.kondisi as keyof typeof stockPerKondisi] += item._sum.jumlah || 0
        }
      })

      // Subtract stock out
      stockKeluarByKondisi.forEach(item => {
        if (item.kondisi in stockPerKondisi) {
          stockPerKondisi[item.kondisi as keyof typeof stockPerKondisi] -= item._sum.jumlah || 0
        }
      })

      // Get barang and gudang info
      const barangInfo = await prisma.barang.findUnique({
        where: { id: barangId },
        select: {
          id: true,
          kode: true,
          nama: true,
          satuan: true
        }
      })

      const gudangInfo = await prisma.gudang.findUnique({
        where: { id: gudangId },
        select: {
          id: true,
          kode: true,
          nama: true
        }
      })

      // Calculate total stock
      const totalStock = Object.values(stockPerKondisi).reduce((sum, stock) => sum + stock, 0)

      logger.dbOperation('groupBy calculations', 'BarangMasuk+BarangKeluar', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/barang/stock/by-kondisi', 200, Date.now() - startTime, {
        userId: session.user.id,
        barangId,
        gudangId,
        totalStock,
        stockPerKondisi
      })

      return NextResponse.json({
        totalStock,
        stockPerKondisi,
        barang: barangInfo,
        gudang: gudangInfo
      })

    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching stock by condition', error, {
      path: '/api/inventory/barang/stock/by-kondisi',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal mengambil informasi stok per kondisi' },
      { status: 500 }
    )
  }
}