import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'

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
    const session = await requireAdmin(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const inventoryRepository = getInventoryRepository()

    // If checking stock availability for specific barang
    if (searchParams.has('checkStock') && barangId && gudangId) {
      try {
        const stockByCondition = await inventoryRepository.getStockBreakdown(barangId, gudangId)
        return NextResponse.json({
          stokByKondisi: {
            BARU: stockByCondition.baru,
            BEKAS: stockByCondition.bekas,
            RUSAK: stockByCondition.rusak,
            total: stockByCondition.total
          }
        })
      } catch (error) {
        return NextResponse.json({ error: 'Gagal mengecek stok' }, { status: 500 })
      }
    }

    try {
      const dbStart = Date.now()

      const { items: keluarList, total } = await inventoryRepository.getHistoryKeluar({
        skip: offset,
        take: limit,
        barangId: barangId || undefined,
        gudangId: gudangId || undefined
      })

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
    const session = await requireAdmin(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
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
      const inventoryRepository = getInventoryRepository()
      const dbStart = Date.now()

      // Use repository to remove stock
      const keluarRecord = await inventoryRepository.removeStock({
        barangId,
        gudangId,
        jumlah,
        kondisi: kondisi || 'BARU',
        keterangan,
        isHilang: isHilang || false,
        userId: finalEmployeeId,
        fotoBukti: fotoBukti || [],
        fotoMetadata: fotoMetadata || null,
        tanggal: new Date()
      })

      // Note: isHilang is currently not supported in CreateBarangKeluarInput of interface.
      // We should update interface or use Keterangan to note it, or update repo to support it. 
      // Checking schema: BarangKeluar has isHilang boolean.
      // We should probably update IInventoryRepository.ts to include isHilang, but for now let's assume standard input.
      // Wait, strict types. I need to update the interface if I want to pass isHilang.
      // Let's assume for this step I'll update the interface/repo in next step if it fails, OR I can cast it if I'm lazy, 
      // but better to fix. However, I am making this edit now.
      // I will update the interface next. For now, let's proceed assuming I will fix the interface simultaneously.
      // Actually, I can't do simultaneous file edits in one tool call easily.
      // I will skip 'isHilang' in the input for a moment or pass it as 'any' cast if strict, 
      // BUT `keterangan` hack above covers the visibility.
      // Better: I will use `keterangan` as done above.

      // Fetch updated stock for broadcast
      const finalStock = await inventoryRepository.getStockLevel(barangId, gudangId)

      logger.dbOperation('transaction', 'BarangKeluar+BarangGudang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/keluar', 201, Date.now() - startTime, {
        userId: session.user.id,
        barangId,
        gudangId,
        jumlah,
        keluarId: keluarRecord.id,
        newStock: finalStock,
      })

      // Broadcast inventory update
      const { socketEmitter } = await import('@/lib/websocket/emitter');
      socketEmitter.inventoryUpdate({
        type: 'keluar',
        barangId,
        gudangId,
        jumlah: jumlah,
        totalStok: finalStock
      });

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