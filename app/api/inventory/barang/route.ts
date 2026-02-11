import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

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
    const session = await verifyAuth(req)
    if (!session) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("barang:read"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat barang')
    }

    const searchParams = req.nextUrl.searchParams
    const gudangId = searchParams.get('gudangId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    try {
      const dbStart = Date.now()
      const inventoryRepository = getInventoryRepository()

      // Enforce Site Restriction
      const permissions = await getUserPermissions(session.id);
      const isSuper = isSuperAdmin(session)

      // Check restriction: barang:site_only (specific) OR k_barang:site_only (mobile) OR gudang:site_only (inherited)
      const hasRestriction = permissions.includes('barang:site_only') ||
                             permissions.includes('k_barang:site_only') ||
                             permissions.includes('gudang:site_only')

      const siteId = (!isSuper && hasRestriction) ? session.siteId : undefined

      const findAllParams: Parameters<typeof inventoryRepository.findAllBarang>[0] = {
        skip: offset,
        take: limit,
      }

      if (search) findAllParams.search = search
      if (gudangId) findAllParams.gudangId = gudangId
      if (siteId) findAllParams.siteId = siteId

      const { items: barangs, total } = await inventoryRepository.findAllBarang(findAllParams)

      // Calculate total stock per item and filter by gudang if needed
      const barangsWithStock = barangs.map(barang => {
        let totalStock = 0
        let stockPerGudang: {
          gudangId: string;
          gudangKode: string;
          gudangNama: string;
          stok: number;
          stokBaru: number;
          stokBekas: number;
          stokRusak: number;
        }[] = []

        if (barang.barangGudang) {
          // Filter stocks by gudangId if specified, otherwise show all
          const filteredStocks = gudangId
            ? barang.barangGudang.filter(stock => stock.gudangId === gudangId)
            : barang.barangGudang

          if (filteredStocks.length > 0) {
            console.log('DEBUG STOCK ITEM [0]:', JSON.stringify(filteredStocks[0], null, 2))
          }

          totalStock = filteredStocks.reduce((sum, stock) => sum + stock.stok, 0)

          stockPerGudang = filteredStocks.map(stock => ({
            gudangId: stock.gudangId,
            gudangKode: stock.gudang.kode,
            gudangNama: stock.gudang.nama,
            stok: stock.stok,
            stokBaru: (stock as unknown as Record<string, number>).stokBaru || 0,
            stokBekas: (stock as unknown as Record<string, number>).stokBekas || 0,
            stokRusak: (stock as unknown as Record<string, number>).stokRusak || 0
          }))
        }

        return {
          id: barang.id,
          kode: barang.kode,
          nama: barang.nama,
          satuan: barang.satuan,
          isWorkOrderMaterial: barang.isWorkOrderMaterial,
          jenis: barang.jenis,
          kategoriAset: barang.kategoriAset,
          createdAt: barang.createdAt,
          updatedAt: barang.updatedAt,
          totalStock,
          stockPerGudang
        }
      })

      logger.dbOperation('findMany', 'Barang+BarangGudang', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/barang', 200, Date.now() - startTime, {
        userId: session.id,
        barangCount: barangsWithStock.length,
        page,
        limit,
        total,
        gudangId,
        search,
      })

      return apiSuccess({
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan');
    logger.error('Error fetching barangs', err, {
      path: '/api/inventory/barang',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data barang')
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
    const session = await verifyAuth(req)
    if (!session) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("barang:create"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat barang')
    }

    const body = await req.json()
    const { nama, satuan, isWorkOrderMaterial } = body

    // Validation
    if (!nama || !satuan) {
      return apiError('Nama dan satuan barang harus diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    try {
      const dbStart = Date.now()
      const inventoryRepository = getInventoryRepository()

      // Generate unique kode
      let kode: string
      let attempts = 0
      const maxAttempts = 10

      do {
        kode = await generateBarangCode()
        const isExists = await inventoryRepository.existsBarangByKode(kode)

        if (!isExists) break
        attempts++
      } while (attempts < maxAttempts)

      if (attempts >= maxAttempts) {
        throw new Error('Gagal generate kode unik')
      }

      const barang = await inventoryRepository.createBarang({
        kode,
        nama,
        satuan,
        isWorkOrderMaterial,
        jenis: body.jenis,
        kategoriAset: body.kategoriAset
      })

      logger.dbOperation('create', 'Barang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/barang', 201, Date.now() - startTime, {
        userId: session.id,
        barangId: barang.id,
        kode: barang.kode,
      })

      // System Log (Persistent)
      await logger.logActivity({
        action: 'CREATE',
        subject: 'Barang',
        userId: session.id,
        details: { id: barang.id, nama: barang.nama, kode: barang.kode }
      })


      return apiSuccess({ barang }, { status: 201, message: 'Barang berhasil dibuat' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan');
    logger.error('Error creating barang', err, {
      path: '/api/inventory/barang',
      method: 'POST',
    })
    const message = error instanceof Error ? error.message : 'Gagal membuat barang'
    return ApiErrors.internalError(message)
  }
}