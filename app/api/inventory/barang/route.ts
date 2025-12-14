import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, getCurrentSession } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * @swagger
 * /api/inventory/barang:
 *   get:
 *     summary: Get all inventory items
 *     description: Retrieve a list of all inventory items with stock information per warehouse
 *     tags: [Inventory Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: gudangId
 *         schema:
 *           type: integer
 *         description: Filter by warehouse ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in item code and name
 *     responses:
 *       200:
 *         description: Successfully retrieved inventory items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 barangs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Barang'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 *
 *   post:
 *     summary: Create a new inventory item
 *     description: Add a new item to the inventory system
 *     tags: [Inventory Management]
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
 *               - nama
 *               - satuan
 *             properties:
 *               nama:
 *                 type: string
 *                 description: Item name
 *                 example: "Fiber Optic Cable"
 *               satuan:
 *                 type: string
 *                 description: Unit of measurement
 *                 example: "meter"
 *               kode:
 *                 type: string
 *                 description: Item code (optional, will be auto-generated if not provided)
 *                 example: "FOC-001"
 *               deskripsi:
 *                 type: string
 *                 description: Item description
 *                 example: "Single mode fiber optic cable for FTTH"
 *               kategori:
 *                 type: string
 *                 description: Item category
 *                 example: "Cable"
 *               merek:
 *                 type: string
 *                 description: Brand/manufacturer
 *                 example: "Corning"
 *               hargaBeli:
 *                 type: number
 *                 format: decimal
 *                 description: Purchase price per unit
 *                 example: 50000
 *               hargaJual:
 *                 type: number
 *                 format: decimal
 *                 description: Selling price per unit
 *                 example: 75000
 *               stokMinimum:
 *                 type: integer
 *                 minimum: 0
 *                 description: Minimum stock level for alerts
 *                 example: 100
 *               foto:
 *                 type: string
 *                 format: uri
 *                 description: Item photo URL
 *                 example: "https://example.com/photos/fiber-cable.jpg"
 *     responses:
 *       201:
 *         description: Successfully created inventory item
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Created item ID
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "Item created successfully"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    // Cek autentikasi admin menggunakan fungsi terpusat
    const session = await requireAdmin(req)

    const searchParams = req.nextUrl.searchParams
    const gudangId = searchParams.get('gudangId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    try {
      const dbStart = Date.now()

      // Build where clause
      const where: any = {}

      if (search) {
        where.OR = [
          { kode: { contains: search, mode: 'insensitive' } },
          { nama: { contains: search, mode: 'insensitive' } }
        ]
      }

      const [barangs, total] = await Promise.all([
        prisma.barang.findMany({
          where,
          orderBy: {
            createdAt: 'desc'
          },
          skip: offset,
          take: limit,
          include: {
            // Get ALL stocks for total calculation
            stok: {
              include: {
                gudang: {
                  select: {
                    id: true,
                    kode: true,
                    nama: true
                  }
                }
              }
            }
          }
        }),
        prisma.barang.count({ where })
      ])

      // Calculate total stock per item and filter by gudang if needed
      const barangsWithStock = barangs.map(barang => {
        let totalStock = 0
        let stockPerGudang: any[] = []

        if (barang.stok) {
          // Calculate TOTAL stock from ALL warehouses
          totalStock = barang.stok.reduce((sum, stock) => sum + stock.stok, 0)

          // Filter stocks by gudangId if specified, otherwise show all
          const filteredStocks = gudangId
            ? barang.stok.filter(stock => stock.gudangId === gudangId)
            : barang.stok

          stockPerGudang = filteredStocks.map(stock => ({
            gudangId: stock.gudangId,
            gudangKode: stock.gudang.kode,
            gudangNama: stock.gudang.nama,
            stok: stock.stok
          }))
        }

        return {
          ...barang,
          totalStock,
          stockPerGudang
        }
      })

      logger.dbOperation('findMany', 'Barang+BarangGudang', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/barang', 200, Date.now() - startTime, {
        userId: session.user.id,
        barangCount: barangsWithStock.length,
        page,
        limit,
        total,
        gudangId,
        search,
      })

      return NextResponse.json({
        barangs: barangsWithStock,
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
    logger.error('Error fetching barangs', error, {
      path: '/api/inventory/barang',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data barang' },
      { status: 500 }
    )
  }
}

/**
 * Generate automatic barang code
 */
async function generateBarangCode(): Promise<string> {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  return `BRG${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`
}

/**
 * POST /api/inventory/barang
 * Create new item
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    // Cek autentikasi admin menggunakan fungsi terpusat
    const session = await requireAdmin(req)

    const body = await req.json()
    const { nama, satuan } = body

    // Validation
    if (!nama || !satuan) {
      return NextResponse.json(
        { error: 'Nama dan satuan barang harus diisi' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()

      // Generate unique kode
      let kode: string
      let attempts = 0
      const maxAttempts = 10

      do {
        kode = await generateBarangCode()
        const existingBarang = await prisma.barang.findUnique({
          where: { kode }
        })

        if (!existingBarang) break
        attempts++
      } while (attempts < maxAttempts)

      if (attempts >= maxAttempts) {
        throw new Error('Gagal generate kode unik')
      }

      const barang = await prisma.barang.create({
        data: {
          kode,
          nama,
          satuan
        }
      })

      logger.dbOperation('create', 'Barang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/barang', 201, Date.now() - startTime, {
        userId: session.user.id,
        barangId: barang.id,
        kode: barang.kode,
      })

      return NextResponse.json({ barang }, { status: 201 })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error creating barang', error, {
      path: '/api/inventory/barang',
      method: 'POST',
    })
    return NextResponse.json(
      { error: error.message || 'Gagal membuat barang' },
      { status: 500 }
    )
  }
}