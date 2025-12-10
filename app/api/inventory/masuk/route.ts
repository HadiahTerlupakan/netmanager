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
 * GET /api/inventory/masuk
 * Get all stock-in movements with filters
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAuth()
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
            },
            // Include user info if available
            ...(session.user.role === 'ADMIN' ? {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            } : {})
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
    const session = await requireAuth()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/masuk')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      barangId,
      gudangId,
      jumlah,
      kondisi,
      keterangan,
      fotoBukti,
      fotoMetadata
    } = body

    // Validation
    const parsedJumlah = Number(jumlah)
    console.log('DEBUG - Received data:', { barangId, gudangId, jumlah, parsedJumlah, kondisi, keterangan })

    if (!barangId || !gudangId || !jumlah || isNaN(parsedJumlah) || parsedJumlah <= 0) {
      console.log('DEBUG - Validation failed:', {
        barangId: !!barangId,
        gudangId: !!gudangId,
        jumlah: !!jumlah,
        isNaN: isNaN(parsedJumlah),
        parsedJumlah,
        parsedJumlahLeq0: parsedJumlah <= 0
      })
      return NextResponse.json(
        { error: 'Barang, gudang, dan jumlah harus diisi dengan benar' },
        { status: 400 }
      )
    }

    // Validate photo data if provided
    if (fotoBukti && !Array.isArray(fotoBukti)) {
      return NextResponse.json(
        { error: 'fotoBukti harus berupa array URL foto' },
        { status: 400 }
      )
    }

    if (fotoMetadata && typeof fotoMetadata !== 'object') {
      return NextResponse.json(
        { error: 'fotoMetadata harus berupa object JSON' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()
      const masukRecord = await prisma.$transaction(async (tx) => {
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
        const newMasukRecord = await tx.barangMasuk.create({
          data: {
            barangId,
            gudangId,
            jumlah: parsedJumlah,
            kondisi: kondisi || 'BARU',
            keterangan,
            employeeId: session.user.id,
            fotoBukti: fotoBukti || [],
            fotoMetadata: fotoMetadata || null
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
              stok: existingStock.stok + parsedJumlah
            }
          })
        } else {
          // Create new stock record
          await tx.barangGudang.create({
            data: {
              barangId,
              gudangId,
              stok: parsedJumlah
            }
          })
        }

        logger.dbOperation('transaction', 'BarangMasuk+BarangGudang', Date.now() - dbStart)

        logger.apiRequest('POST', '/api/inventory/masuk', 201, Date.now() - startTime, {
          userId: session.user.id,
          barangId,
          gudangId,
          jumlah: parsedJumlah,
          masukId: newMasukRecord.id,
        })

        return newMasukRecord
      })

      return NextResponse.json(
        {
          message: 'Barang masuk berhasil dicatat',
          masukId: masukRecord.id,
          data: masukRecord
        },
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
