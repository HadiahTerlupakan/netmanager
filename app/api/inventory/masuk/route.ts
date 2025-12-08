import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

/**
 * GET /api/inventory/masuk
 * Get all stock-in movements with filters
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/masuk')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    try {
      const dbStart = Date.now()

      // Build where clause
      const where: any = {}
      if (barangId) where.barangId = barangId
      if (gudangId) where.gudangId = gudangId

      const [masukList, total] = await Promise.all([
        prisma.barangMasuk.findMany({
          where,
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
          },
          orderBy: {
            tanggal: 'desc'
          },
          skip: offset,
          take: limit
        }),
        prisma.barangMasuk.count({ where })
      ])

      logger.dbOperation('findMany', 'BarangMasuk+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/masuk', 200, Date.now() - startTime, {
        userId: session.user.id,
        count: masukList.length,
        page,
        limit,
        total,
        barangId,
        gudangId,
      })

      return NextResponse.json({
        masukList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching barang masuk', error, {
      path: '/api/inventory/masuk',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data barang masuk' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/masuk
 * Record new stock-in movement
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/masuk')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { barangId, gudangId, jumlah, kondisi, keterangan } = body

    // Validation
    if (!barangId || !gudangId || !jumlah || jumlah <= 0) {
      return NextResponse.json(
        { error: 'Barang, gudang, dan jumlah harus diisi dengan benar' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()
      await prisma.$transaction(async (tx) => {
        // Check if barang exists
        const barang = await tx.barang.findUnique({
          where: { id: barangId }
        })

        if (!barang) {
          throw new Error('Barang tidak ditemukan')
        }

        // Check if gudang exists
        const gudang = await tx.gudang.findUnique({
          where: { id: gudangId, isActive: true }
        })

        if (!gudang) {
          throw new Error('Gudang tidak ditemukan atau tidak aktif')
        }

        // Create stock-in record
        const masukRecord = await tx.barangMasuk.create({
          data: {
            barangId,
            gudangId,
            jumlah,
            kondisi: kondisi || 'BARU',
            keterangan
          }
        })

        // Update or create BarangGudang record
        const existingStock = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId, gudangId } }
        })

        if (existingStock) {
          // Update existing stock
          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId, gudangId } },
            data: {
              stok: existingStock.stok + jumlah
            }
          })
        } else {
          // Create new stock record
          await tx.barangGudang.create({
            data: {
              barangId,
              gudangId,
              stok: jumlah
            }
          })
        }

        logger.dbOperation('transaction', 'BarangMasuk+BarangGudang', Date.now() - dbStart)

        logger.apiRequest('POST', '/api/inventory/masuk', 201, Date.now() - startTime, {
          userId: session.user.id,
          barangId,
          gudangId,
          jumlah,
          masukId: masukRecord.id,
        })

        return masukRecord
      })

      return NextResponse.json(
        { message: 'Barang masuk berhasil dicatat' },
        { status: 201 }
      )
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error creating barang masuk', error, {
      path: '/api/inventory/masuk',
      method: 'POST',
    })

    if (error.message === 'Barang tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Gudang tidak ditemukan atau tidak aktif') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Gagal mencatat barang masuk' },
      { status: 500 }
    )
  }
}