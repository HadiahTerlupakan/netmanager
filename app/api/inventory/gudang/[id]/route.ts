import { getInventoryRepository } from '@/lib/repositories'
import { logger, logActivitySafe } from '@/lib/logger'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { hasPermission } from '@/lib/rbac'

// Standardized permission checks used in route handlers

/**
 * GET /api/inventory/gudang/[id]
 * Get specific warehouse by ID
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const { id } = ctx.params

  if (!(await hasPermission("gudang:read"))) {
    return ApiErrors.forbidden()
  }

  const inventoryRepository = getInventoryRepository()

  try {
    const dbStart = Date.now()

    const gudang = await inventoryRepository.findGudangById(id)

    if (!gudang) {
      return ApiErrors.notFound('Gudang tidak ditemukan')
    }

    logger.dbOperation('findUnique', 'Gudang', Date.now() - dbStart)

    logger.apiRequest('GET', `/api/inventory/gudang/${id}`, 200, Date.now() - startTime, {
      userId: ctx.session!.user.id,
      gudangId: gudang.id,
    })

    return apiSuccess({ gudang })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Error fetching gudang', err, {
      path: '/api/inventory/gudang/[id]',
      method: 'GET',
      id: 'unknown',
    })
    return ApiErrors.internalError('Gagal memuat data gudang')
  }
})

/**
 * PUT /api/inventory/gudang/[id]
 * Update specific warehouse
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const { id } = ctx.params
  const startTime = Date.now()

  if (!(await hasPermission("gudang:update"))) {
    return ApiErrors.forbidden()
  }
  const body = await req.json()
  const { kode, nama, lokasi, isActive } = body

  // Validation
  if (!kode || !nama) {
    return ApiErrors.badRequest('Kode dan nama gudang harus diisi')
  }

  const inventoryRepository = getInventoryRepository()

  try {
    const dbStart = Date.now()

    // Check if gudang exists
    const existingGudang = await inventoryRepository.findGudangById(id)

    if (!existingGudang) {
      return ApiErrors.notFound('Gudang tidak ditemukan')
    }

    // Check if kode conflicts with another gudang
    const kodeConflict = await inventoryRepository.findGudangByKode(kode)

    if (kodeConflict && kodeConflict.id !== id) {
      return ApiErrors.badRequest('Kode gudang sudah digunakan')
    }

    const updatedGudang = await inventoryRepository.updateGudang(id, {
      kode,
      nama,
      lokasi,
      isActive: isActive !== undefined ? isActive : existingGudang.isActive
    })

    logger.dbOperation('update', 'Gudang', Date.now() - dbStart)

    logger.apiRequest('PUT', `/api/inventory/gudang/${id}`, 200, Date.now() - startTime, {
      userId: ctx.session!.user.id,
      gudangId: updatedGudang.id,
    })

    // System Log
    logActivitySafe({
      action: 'UPDATE',
      subject: 'Gudang',
      userId: ctx.session!.user.id,
      details: { id: updatedGudang.id, updates: { kode, nama, lokasi, isActive } }
    })

    return apiSuccess({ gudang: updatedGudang })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Error updating gudang', err, {
      path: '/api/inventory/gudang/[id]',
      method: 'PUT',
      id: 'unknown',
    })
    return ApiErrors.internalError('Gagal mengupdate gudang')
  }
})

/**
 * DELETE /api/inventory/gudang/[id]
 * Delete specific warehouse (hard delete)
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const { id } = ctx.params
  const startTime = Date.now()

  if (!(await hasPermission("gudang:delete"))) {
    return ApiErrors.forbidden()
  }

  const inventoryRepository = getInventoryRepository()

  try {
    const dbStart = Date.now()

    // Check if gudang exists
    const existingGudang = await inventoryRepository.findGudangById(id)

    if (!existingGudang) {
      return ApiErrors.notFound('Gudang tidak ditemukan')
    }

    // Check if gudang has stock
    const hasStock = await inventoryRepository.hasStockInGudang(id)

    if (hasStock) {
      return ApiErrors.badRequest('Tidak dapat menghapus gudang yang masih memiliki stok barang')
    }

    // Hard delete via repository
    await inventoryRepository.deleteGudang(id)

    logger.dbOperation('update', 'Gudang', Date.now() - dbStart)

    logger.apiRequest('DELETE', `/api/inventory/gudang/${id}`, 200, Date.now() - startTime, {
      userId: ctx.session!.user.id,
      gudangId: id,
    })

    // System Log
    logActivitySafe({
      action: 'DELETE',
      subject: 'Gudang',
      userId: ctx.session!.user.id,
      details: { id: id, name: existingGudang.nama }
    })

    return apiSuccess({ message: 'Gudang berhasil dihapus' })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))

    // Check for Prisma Foreign Key Constraint error (P2003)
    if ((error as { code?: string }).code === 'P2003' || err.message?.includes('P2003')) {
      return ApiErrors.badRequest('Gudang tidak dapat dihapus karena masih terelasi dengan data Transaksi (Barang Masuk/Keluar, Transfer, dsb). Pastikan gudang tersebut kosong dan tidak ada riwayat transaksi yang mengikat.')
    }

    logger.error('Error deleting gudang', err, {
      path: '/api/inventory/gudang/[id]',
      method: 'DELETE',
      id: id ?? 'unknown',
    })
    return ApiErrors.internalError('Gagal menghapus gudang')
  }
})
