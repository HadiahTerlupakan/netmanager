import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireAdminOrEmployee() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || !['ADMIN', 'EMPLOYEE'].includes(session?.user?.role)) {
    return null
  }
  return session
}

// Helper function to calculate stock by condition
async function getStockByCondition(barangId: string, gudangId: string) {
  // Get ALL transactions for this barang to calculate current condition breakdown
  const [masukData, keluarData] = await Promise.all([
    prisma.barangMasuk.findMany({
      where: { barangId, gudangId },
      orderBy: { tanggal: 'desc' }
    }),
    prisma.barangKeluar.findMany({
      where: { barangId, gudangId },
      orderBy: { tanggal: 'desc' }
    })
  ])

  // Calculate current stock by condition
  let stokBaru = 0
  let stokBekas = 0
  let stokRusak = 0

  // Process barang masuk
  masukData.forEach((masuk: any) => {
    switch (masuk.kondisi) {
      case 'BARU':
        stokBaru += masuk.jumlah
        break
      case 'BEKAS':
        stokBekas += masuk.jumlah
        break
      case 'RUSAK':
        stokRusak += masuk.jumlah
        break
      default:
        stokBaru += masuk.jumlah
        break
    }
  })

  // Process barang keluar
  keluarData.forEach((keluar: any) => {
    switch (keluar.kondisi) {
      case 'BARU':
        stokBaru = Math.max(0, stokBaru - keluar.jumlah)
        break
      case 'BEKAS':
        stokBekas = Math.max(0, stokBekas - keluar.jumlah)
        break
      case 'RUSAK':
        stokRusak = Math.max(0, stokRusak - keluar.jumlah)
        break
      default:
        stokBaru = Math.max(0, stokBaru - keluar.jumlah)
        break
    }
  })

  return {
    stokBaru,
    stokBekas,
    stokRusak,
    totalStok: stokBaru + stokBekas + stokRusak
  }
}

/**
 * @swagger
 * /api/inventory/keluar:
 *   get:
 *     summary: Get all stock-out movements with filters
 *     description: Retrieve a paginated list of stock-out movements with optional filtering
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: barangId
 *         schema:
 *           type: string
 *         description: Filter by item ID
 *       - in: query
 *         name: gudangId
 *         schema:
 *           type: string
 *         description: Filter by warehouse ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *       - in: query
 *         name: checkStock
 *         schema:
 *           type: boolean
 *         description: Check stock availability for specific item and warehouse (requires barangId and gudangId)
 *     responses:
 *       200:
 *         description: List of stock-out movements retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     keluarList:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           barang:
 *                             $ref: '#/components/schemas/Barang'
 *                           gudang:
 *                             $ref: '#/components/schemas/Gudang'
 *                           user:
 *                             $ref: '#/components/schemas/User'
 *                           jumlah:
 *                             type: integer
 *                           kondisi:
 *                             type: string
 *                             enum: [BARU, BEKAS, RUSAK]
 *                           isHilang:
 *                             type: boolean
 *                           keterangan:
 *                             type: string
 *                             nullable: true
 *                           tanggal:
 *                             type: string
 *                             format: date-time
 *                           fotoBukti:
 *                             type: array
 *                             items:
 *                               type: string
 *                             nullable: true
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                 - type: object
 *                   properties:
 *                     stokByKondisi:
 *                       type: object
 *                       properties:
 *                         BARU:
 *                           type: integer
 *                         BEKAS:
 *                           type: integer
 *                         RUSAK:
 *                           type: integer
 *                         total:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdminOrEmployee()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/keluar')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // If checking stock availability for specific barang
    if (searchParams.has('checkStock') && barangId && gudangId) {
      try {
        const stockByCondition = await getStockByCondition(barangId, gudangId)
        return NextResponse.json({
          stokByKondisi: {
            BARU: stockByCondition.stokBaru,
            BEKAS: stockByCondition.stokBekas,
            RUSAK: stockByCondition.stokRusak,
            total: stockByCondition.totalStok
          }
        })
      } catch (error) {
        return NextResponse.json({ error: 'Gagal mengecek stok' }, { status: 500 })
      }
    }

    try {
      const dbStart = Date.now()

      // Build where clause
      const where: any = {}
      if (barangId) where.barangId = barangId
      if (gudangId) where.gudangId = gudangId

      const [keluarList, total] = await Promise.all([
        prisma.barangKeluar.findMany({
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
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            tanggal: 'desc'
          },
          skip: offset,
          take: limit
        }),
        prisma.barangKeluar.count({ where })
      ])

      logger.dbOperation('findMany', 'BarangKeluar+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/keluar', 200, Date.now() - startTime, {
        userId: session.user.id,
        count: keluarList.length,
        page,
        limit,
        total,
        barangId,
        gudangId,
      })

      return NextResponse.json({
        keluarList,
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
    logger.error('Error fetching barang keluar', error, {
      path: '/api/inventory/keluar',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data barang keluar' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/inventory/keluar:
 *   post:
 *     summary: Record new stock-out movement
 *     description: Remove items from warehouse inventory
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - barangId
 *               - gudangId
 *               - jumlah
 *             properties:
 *               barangId:
 *                 type: string
 *                 description: Item ID
 *               gudangId:
 *                 type: string
 *                 description: Warehouse ID
 *               jumlah:
 *                 type: integer
 *                 description: Quantity to remove (must be > 0)
 *                 minimum: 1
 *               kondisi:
 *                 type: string
 *                 description: Item condition
 *                 enum: [BARU, BEKAS, RUSAK]
 *                 default: BARU
 *               isHilang:
 *                 type: boolean
 *                 description: Whether the item is lost
 *                 default: false
 *               keterangan:
 *                 type: string
 *                 description: Additional notes
 *                 nullable: true
 *               fotoBukti:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of photo URLs as proof
 *                 nullable: true
 *               fotoMetadata:
 *                 type: object
 *                 description: Photo metadata
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Stock-out movement recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Barang keluar berhasil dicatat"
 *                 keluarId:
 *                   type: string
 *                   description: ID of created stock-out record
 *                 data:
 *                   type: object
 *                   description: The created stock-out record
 *       400:
 *         description: Bad request - validation error or insufficient stock
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Item or warehouse not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdminOrEmployee()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/keluar')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    console.log('DEBUG - Keluar API received body:', JSON.stringify(body, null, 2))

    const {
      barangId,
      gudangId,
      jumlah,
      kondisi,
      isHilang,
      keterangan,
      fotoBukti,
      fotoMetadata
    } = body

    console.log('DEBUG - Keluar API parsed data:', {
      barangId,
      gudangId,
      jumlah,
      kondisi,
      isHilang,
      keterangan,
      fotoBukti: fotoBukti ? `Array with ${fotoBukti.length} items` : null,
      fotoMetadata
    })

    // Simplified executor tracking - use current session user
    const finalEmployeeId = session.user.id

    // Validation
    if (!barangId || !gudangId || !jumlah || jumlah <= 0) {
      return NextResponse.json(
        { error: 'Barang, gudang, dan jumlah harus diisi dengan benar' },
        { status: 400 }
      )
    }

    // Validate condition (HILANG is now a separate boolean field)
    const validConditions = ['BARU', 'BEKAS', 'RUSAK']
    if (kondisi && !validConditions.includes(kondisi)) {
      return NextResponse.json(
        { error: 'Kondisi tidak valid. Pilih: BARU, BEKAS, atau RUSAK' },
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
      const keluarRecord = await prisma.$transaction(async (tx) => {
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

        // Get current stock from BarangGudang (authoritative source of truth)
        const currentStock = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId, gudangId } }
        })

        // Validate stock availability using BarangGudang.stok
        if (!currentStock || currentStock.stok === 0) {
          throw new Error('Barang tidak memiliki stok di gudang ini')
        }

        if (currentStock.stok < jumlah) {
          throw new Error(`Stok tidak mencukupi. Stok tersedia: ${currentStock.stok}, diminta: ${jumlah}`)
        }

        // Create stock-out record
        const newKeluarRecord = await tx.barangKeluar.create({
          data: {
            barangId,
            gudangId,
            jumlah,
            kondisi: kondisi || 'BARU',
            isHilang: isHilang || false,
            keterangan,
            employeeId: finalEmployeeId,
            fotoBukti: fotoBukti || [],
            fotoMetadata: fotoMetadata || null
          }
        })

        // Update stock
        const newStock = currentStock.stok - jumlah
        if (newStock === 0) {
          // If stock becomes 0, delete the BarangGudang record
          await tx.barangGudang.delete({
            where: { barangId_gudangId: { barangId, gudangId } }
          })
        } else {
          // Update with reduced stock
          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId, gudangId } },
            data: { stok: newStock }
          })
        }

        logger.dbOperation('transaction', 'BarangKeluar+BarangGudang', Date.now() - dbStart)

        logger.apiRequest('POST', '/api/inventory/keluar', 201, Date.now() - startTime, {
          userId: session.user.id,
          barangId,
          gudangId,
          jumlah,
          keluarId: newKeluarRecord.id,
          previousStock: currentStock.stok,
          newStock: currentStock.stok - jumlah,
        })

        return newKeluarRecord
      })

      return NextResponse.json(
        {
          message: 'Barang keluar berhasil dicatat',
          keluarId: keluarRecord.id,
          data: keluarRecord
        },
        { status: 201 }
      )
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error creating barang keluar', error, {
      path: '/api/inventory/keluar',
      method: 'POST',
    })

    console.error('DEBUG - Keluar API Error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })

    if (error.message === 'Barang tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message === 'Gudang tidak ditemukan atau tidak aktif') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.message.includes('Stok tidak mencukupi') || error.message.includes('tersedia')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: error.message || 'Gagal mencatat barang keluar' },
      { status: 500 }
    )
  }
}