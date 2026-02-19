import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getInventoryRepository } from '@/lib/repositories'
import { logger, logActivitySafe } from '@/lib/logger'
import { validateGudangAccess } from '@/lib/inventory-validation'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import type { Session } from 'next-auth'

/**
 * @swagger
 * /api/inventory/keluar:
 *   get:
 *     summary: Get all stock-out movements with filters
 *     tags: [Inventory]
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user

  if (!(await hasPermission("keluar:read"))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat barang keluar')
  }

  const searchParams = req.nextUrl.searchParams
  const barangId = searchParams.get('barangId') || undefined
  const gudangId = searchParams.get('gudangId') || undefined
  const search = searchParams.get('search') || undefined
  let siteId = searchParams.get('siteId') || undefined
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  // SITE RESTRICTION
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user)

  if (!isSuper && (permissions.includes('keluar:site_only') || permissions.includes('k_barang:site_only'))) {
      const { prisma } = await import('@/lib/prisma');
      const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
      siteId = dbUser?.siteId || undefined
  }

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
      ...(barangId && { barangId }),
      ...(gudangId && { gudangId }),
      ...(search && { search }),
      ...(siteId && { siteId })
    })

    logger.dbOperation('findMany', 'BarangKeluar+Relations', Date.now() - dbStart)

    logger.apiRequest('GET', '/api/inventory/keluar', 200, Date.now() - startTime, {
      count: keluarList.length,
      page,
      limit,
      total,
      userId: user.id,
      barangId,
      gudangId,
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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan');
    logger.error('Error fetching barang keluar', err, {
      path: '/api/inventory/keluar',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data barang keluar')
  }
})

/**
 * @swagger
 * /api/inventory/keluar:
 *   post:
 *     summary: Record new stock-out movement
 *     tags: [Inventory]
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user

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
  const finalEmployeeId = user.id

  // Validation
  if (!barangId || !gudangId || !jumlah || jumlah <= 0) {
    return ApiErrors.badRequest('Barang, gudang, dan jumlah harus diisi dengan benar')
  }

  // Validate condition
  const validConditions = ['BARU', 'BEKAS', 'RUSAK']
  if (kondisi && !validConditions.includes(kondisi)) {
    return ApiErrors.badRequest('Kondisi tidak valid. Pilih: BARU, BEKAS, atau RUSAK')
  }

  // Validate photo data if provided
  if (fotoBukti && !Array.isArray(fotoBukti)) {
    return ApiErrors.badRequest('fotoBukti harus berupa array URL foto')
  }

  if (fotoMetadata && typeof fotoMetadata !== 'object') {
    return ApiErrors.badRequest('fotoMetadata harus berupa object JSON')
  }

  // Fetch full user to mock session for validateGudangAccess
  const { prisma } = await import('@/lib/prisma');
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { siteId: true, role: true } });
  
  const mockSession = {
      user: {
          ...user,
          siteId: dbUser?.siteId,
          role: dbUser?.role || user.role
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  const access = await validateGudangAccess(mockSession as Session, gudangId)
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
      userId: user.id
    })

    // System Log
    logActivitySafe({
      action: 'CREATE',
      subject: 'Inventory Out',
      details: { id: keluarRecord.id, barangId, gudangId, quantity: jumlah },
      userId: user.id
    })

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
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan');
    logger.error('Error creating barang keluar', err, {
      path: '/api/inventory/keluar',
      method: 'POST',
    })

    if (err.message === 'Barang tidak ditemukan') {
      return ApiErrors.notFound('Barang')
    }
    if (err.message === 'Gudang tidak ditemukan atau tidak aktif') {
      return ApiErrors.badRequest('Gudang tidak ditemukan atau tidak aktif')
    }
    if (err.message.includes('Stok tidak mencukupi') || err.message.includes('tersedia')) {
      return ApiErrors.badRequest(err.message)
    }

    return ApiErrors.internalError(err.message || 'Gagal mencatat barang keluar')
  }
})
