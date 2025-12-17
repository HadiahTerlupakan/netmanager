import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'

/**
 * @swagger
 * /api/inventory/masuk:
 *   get:
 *     summary: Get all stock-in movements with filters
 *     description: Retrieve a paginated list of stock-in movements with optional filtering
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
 *     responses:
 *       200:
 *         description: List of stock-in movements retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 masukList:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       barang:
 *                         $ref: '#/components/schemas/Barang'
 *                       gudang:
 *                         $ref: '#/components/schemas/Gudang'
 *                       user:
 *                         $ref: '#/components/schemas/User'
 *                       jumlah:
 *                         type: integer
 *                       kondisi:
 *                         type: string
 *                         enum: [BARU, BEKAS, RUSAK]
 *                       keterangan:
 *                         type: string
 *                         nullable: true
 *                       tanggal:
 *                         type: string
 *                         format: date-time
 *                       fotoBukti:
 *                         type: array
 *                         items:
 *                           type: string
 *                         nullable: true
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
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
    const session = await requireAuth(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    try {
      const dbStart = Date.now()

      const inventoryRepository = getInventoryRepository()

      const { items: masukList, total } = await inventoryRepository.getHistoryMasuk({
        skip: offset,
        take: limit,
        barangId: barangId || undefined,
        gudangId: gudangId || undefined
      })

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
 * @swagger
 * /api/inventory/masuk:
 *   post:
 *     summary: Record new stock-in movement
 *     description: Add new items to warehouse inventory
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
 *                 description: Quantity to add (must be > 0)
 *                 minimum: 1
 *               kondisi:
 *                 type: string
 *                 description: Item condition
 *                 enum: [BARU, BEKAS, RUSAK]
 *                 default: BARU
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
 *         description: Stock-in movement recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Barang masuk berhasil dicatat"
 *                 masukId:
 *                   type: string
 *                   description: ID of the created stock-in record
 *                 data:
 *                   type: object
 *                   description: The created stock-in record
 *       400:
 *         description: Bad request - validation error
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
    const session = await requireAuth(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
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
      const inventoryRepository = getInventoryRepository()
      const dbStart = Date.now()

      // Use repository to add stock
      const masukRecord = await inventoryRepository.addStock({
        barangId,
        gudangId,
        jumlah: parsedJumlah,
        kondisi: kondisi || 'BARU',
        keterangan,
        userId: session.user.id,
        fotoBukti: fotoBukti || [],
        fotoMetadata: fotoMetadata || null,
        tanggal: new Date()
      })

      // Get updated stock level for WebSocket broadcast
      // We do this separately as repository method handles the transaction internally
      const finalStock = await inventoryRepository.getStockLevel(barangId, gudangId)

      logger.dbOperation('transaction', 'BarangMasuk+BarangGudang', Date.now() - dbStart)
      logger.apiRequest('POST', '/api/inventory/masuk', 201, Date.now() - startTime, {
        userId: session.user.id,
        barangId,
        gudangId,
        jumlah: parsedJumlah,
        masukId: masukRecord.id,
      })

      // System Log
      try {
        await logger.logActivity({
          action: 'CREATE',
          subject: 'Inventory In',
          userId: session.user.id,
          details: { id: masukRecord.id, barangId, gudangId, quantity: parsedJumlah }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      // Broadcast inventory update
      const { socketEmitter } = await import('@/lib/websocket/emitter');
      socketEmitter.inventoryUpdate({
        type: 'masuk',
        barangId,
        gudangId,
        jumlah: parsedJumlah,
        totalStok: finalStock
      });

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
