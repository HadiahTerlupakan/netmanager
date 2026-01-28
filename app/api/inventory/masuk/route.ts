import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getUserPermissions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'
import { validateGudangAccess } from '@/lib/inventory-validation'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

/**
 * @swagger
 * /api/inventory/masuk:
 *   get:
 *     summary: Get all stock-in movements with filters
 *     tags: [Inventory]
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("masuk:read"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat barang masuk')
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const search = searchParams.get('search')
    let siteId = searchParams.get('siteId')
    const page = parseInt(searchParams.get('page') || '1')

    // SITE RESTRICTION
    const permissions = await getUserPermissions(session.user.id!);
    const isSuperAdmin = (session.user as any).role === 'SUPER_ADMIN'
    
    if (!isSuperAdmin && (permissions.includes('masuk:site_only') || permissions.includes('k_barang:site_only'))) {
        siteId = (session.user as any).siteId
    }
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    try {
      const dbStart = Date.now()

      const inventoryRepository = getInventoryRepository()

      const { items: masukList, total } = await inventoryRepository.getHistoryMasuk({
        skip: offset,
        take: limit,
        barangId: barangId || undefined,
        gudangId: gudangId || undefined,
        search: search || undefined,
        siteId: siteId || undefined
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

      return apiSuccess({
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
    return ApiErrors.internalError('Gagal memuat data barang masuk')
  }
}

/**
 * @swagger
 * /api/inventory/masuk:
 *   post:
 *     summary: Record new stock-in movement
 *     tags: [Inventory]
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("masuk:create"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat barang masuk')
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

    if (!barangId || !gudangId || !jumlah || isNaN(parsedJumlah) || parsedJumlah <= 0) {
      return apiError('Barang, gudang, dan jumlah harus diisi dengan benar', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // Validate photo data if provided
    if (fotoBukti && !Array.isArray(fotoBukti)) {
      return apiError('fotoBukti harus berupa array URL foto', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    if (fotoMetadata && typeof fotoMetadata !== 'object') {
      return apiError('fotoMetadata harus berupa object JSON', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const access = await validateGudangAccess(session, gudangId)
    if (!access.allowed) {
      return ApiErrors.forbidden(access.error || 'Anda tidak memiliki akses ke gudang ini')
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
        userId: session.user.id as string,
        barangId,
        gudangId,
        jumlah: parsedJumlah,
        totalStok: finalStock
      });

      return apiSuccess({
        message: 'Barang masuk berhasil dicatat',
        masukId: masukRecord.id,
        data: masukRecord
      }, { status: 201 })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error creating barang masuk', error, {
      path: '/api/inventory/masuk',
      method: 'POST',
    })

    if (error.message === 'Barang tidak ditemukan') {
      return ApiErrors.notFound('Barang')
    }
    if (error.message === 'Gudang tidak ditemukan atau tidak aktif') {
      return apiError('Gudang tidak ditemukan atau tidak aktif', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    return ApiErrors.internalError('Gagal mencatat barang masuk')
  }
}
