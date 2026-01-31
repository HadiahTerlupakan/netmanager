import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getInventoryRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { hasPermission } from '@/lib/rbac'

// Standardized permission checks used in route handlers

/**
 * GET /api/inventory/gudang/[id]
 * Get specific warehouse by ID
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authConfig)
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/gudang/[id]')
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("gudang:read"))) {
      return ApiErrors.forbidden()
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      const gudang = await inventoryRepository.findGudangById(id)

      if (!gudang) {
        return ApiErrors.notFound('Gudang tidak ditemukan')
      }

      logger.dbOperation('findUnique', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('GET', `/api/inventory/gudang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        gudangId: gudang.id,
      })

      return apiSuccess({ gudang })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Error fetching gudang', err, {
      path: '/api/inventory/gudang/[id]',
      method: 'GET',
      id: 'unknown',
    })
    return ApiErrors.internalError('Gagal memuat data gudang')
  }
}

/**
 * PUT /api/inventory/gudang/[id]
 * Update specific warehouse
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const startTime = Date.now()
  try {
    const session = await getServerSession(authConfig)
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/gudang/[id]')
      return ApiErrors.unauthorized()
    }

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
        userId: session.user.id,
        gudangId: updatedGudang.id,
      })

      // System Log
      try {
        const { logger } = await import('@/lib/logger')
        await logger.logActivity({
          action: 'UPDATE',
          subject: 'Gudang',
          userId: session.user.id,
          details: { id: updatedGudang.id, updates: { kode, nama, lokasi, isActive } }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return apiSuccess({ gudang: updatedGudang })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Error updating gudang', err, {
      path: '/api/inventory/gudang/[id]',
      method: 'PUT',
      id: 'unknown',
    })
    return ApiErrors.internalError('Gagal mengupdate gudang')
  }
}

/**
 * DELETE /api/inventory/gudang/[id]
 * Delete specific warehouse (soft delete by setting isActive to false)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const startTime = Date.now()
  try {
    const session = await getServerSession(authConfig)
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to DELETE /api/inventory/gudang/[id]')
      return ApiErrors.unauthorized()
    }

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

      // Soft delete by setting isActive to false (via repository deleteGudang)
      await inventoryRepository.deleteGudang(id)

      logger.dbOperation('update', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('DELETE', `/api/inventory/gudang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        gudangId: id,
      })

      // System Log
      try {
        const { logger } = await import('@/lib/logger')
        await logger.logActivity({
          action: 'DELETE',
          subject: 'Gudang',
          userId: session.user.id,
          details: { id: id, name: existingGudang.nama }
        })
      } catch (e) {
        console.error('Logging failed', e)
      }

      return apiSuccess({ message: 'Gudang berhasil dihapus' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    logger.error('Error deleting gudang', err, {
      path: '/api/inventory/gudang/[id]',
      method: 'DELETE',
      id: id ?? 'unknown',
    })
    return ApiErrors.internalError('Gagal menghapus gudang')
  }
}