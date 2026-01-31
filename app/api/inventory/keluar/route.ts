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
 * /api/inventory/keluar:
 *   get:
 *     summary: Get all stock-out movements with filters
 *     tags: [Inventory]
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("keluar:read"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat barang keluar')
    }

    const searchParams = req.nextUrl.searchParams
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const search = searchParams.get('search')
    let siteId = searchParams.get('siteId')
    const page = parseInt(searchParams.get('page') || '1')

    // SITE RESTRICTION
    const permissions = await getUserPermissions(session.user.id!);
    const isSuperAdmin = (session.user as { role?: string }).role === 'SUPER_ADMIN'

    if (!isSuperAdmin && (permissions.includes('keluar:site_only') || permissions.includes('k_barang:site_only'))) {
        siteId = (session.user as { siteId?: string }).siteId
    }
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const inventoryRepository = getInventoryRepository()

    // If checking stock availability for specific barang
    if (searchParams.has('checkStock') && barangId && gudangId) {
      try {
        const stockByCondition = await inventoryRepository.getStockBreakdown(barangId, gudangId)
        return apiSuccess({
          stokByKondisi: {
            BARU: stockByCondition.baru,
            BEKAS: stockByCondition.bekas,
            RUSAK: stockByCondition.rusak,
            total: stockByCondition.total
          }
        })
      } catch (_error) {
        return ApiErrors.internalError('Gagal mengecek stok')
      }
    }

    try {
      const dbStart = Date.now()

      const { items: keluarList, total } = await inventoryRepository.getHistoryKeluar({
        skip: offset,
        take: limit,
        ...(barangId ? { barangId } : {}),
        ...(gudangId ? { gudangId } : {}),
        ...(search ? { search } : {}),
        ...(siteId ? { siteId } : {})
      })

      logger.dbOperation('findMany', 'BarangKeluar+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/keluar', 200, Date.now() - startTime, {
        count: keluarList.length,
        page,
        limit,
        total,
        ...(session.user.id ? { userId: session.user.id } : {}),
        ...(barangId ? { barangId } : {}),
        ...(gudangId ? { gudangId } : {}),
      })

      return apiSuccess({
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error fetching barang keluar', err, {
      path: '/api/inventory/keluar',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data barang keluar')
  }
}

/**
 * @swagger
 * /api/inventory/keluar:
 *   post:
 *     summary: Record new stock-out movement
 *     tags: [Inventory]
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("keluar:create"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat barang keluar')
    }

    const body = await req.json()

    const {
      barangId,
      gudangId,
      jumlah,
      kondisi,
      isHilang,
      tujuanPenggunaan,
      keterangan,
      fotoBukti,
      fotoMetadata
    } = body

    // Simplified executor tracking - use current session user
    const finalEmployeeId = session.user.id

    // Validation
    if (!barangId || !gudangId || !jumlah || jumlah <= 0) {
      return apiError('Barang, gudang, dan jumlah harus diisi dengan benar', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // Validate condition
    const validConditions = ['BARU', 'BEKAS', 'RUSAK']
    if (kondisi && !validConditions.includes(kondisi)) {
      return apiError('Kondisi tidak valid. Pilih: BARU, BEKAS, atau RUSAK', ErrorCodes.VALIDATION_ERROR, { status: 400 })
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

      // Use repository to remove stock
      const keluarRecord = await inventoryRepository.removeStock({
        barangId,
        gudangId,
        jumlah,
        kondisi: kondisi || 'BARU',
        tujuanPenggunaan,
        keterangan,
        isHilang: isHilang || false,
        fotoBukti: fotoBukti || [],
        fotoMetadata: fotoMetadata || null,
        tanggal: new Date(),
        ...(finalEmployeeId ? { userId: finalEmployeeId } : {})
      })

      // Fetch updated stock for broadcast
      const finalStock = await inventoryRepository.getStockLevel(barangId, gudangId)

      logger.dbOperation('transaction', 'BarangKeluar+BarangGudang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/keluar', 201, Date.now() - startTime, {
        barangId,
        gudangId,
        jumlah,
        keluarId: keluarRecord.id,
        newStock: finalStock,
        ...(session.user.id ? { userId: session.user.id } : {})
      })

      // System Log
      try {
        await logger.logActivity({
          action: 'CREATE',
          subject: 'Inventory Out',
          details: { id: keluarRecord.id, barangId, gudangId, quantity: jumlah },
          ...(session.user.id ? { userId: session.user.id } : {})
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      // Broadcast inventory update
      const { socketEmitter } = await import('@/lib/websocket/emitter');
      socketEmitter.inventoryUpdate({
        type: 'keluar',
        userId: finalEmployeeId as string,
        barangId,
        gudangId,
        jumlah: jumlah,
        totalStok: finalStock
      });

      return apiSuccess({
        message: 'Barang keluar berhasil dicatat',
        keluarId: keluarRecord.id,
        data: keluarRecord
      }, { status: 201 })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Error creating barang keluar', err, {
      path: '/api/inventory/keluar',
      method: 'POST',
    })

    if (err.message === 'Barang tidak ditemukan') {
      return ApiErrors.notFound('Barang')
    }
    if (err.message === 'Gudang tidak ditemukan atau tidak aktif') {
      return apiError('Gudang tidak ditemukan atau tidak aktif', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }
    if (err.message.includes('Stok tidak mencukupi') || err.message.includes('tersedia')) {
      return apiError(err.message, ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    return ApiErrors.internalError(err.message || 'Gagal mencatat barang keluar')
  }
}