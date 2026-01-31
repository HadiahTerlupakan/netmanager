import { NextRequest } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { getInventoryRepository } from '@/lib/repositories'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

async function requireAdmin() {
  const session = await getServerSession(authConfig) as Session | null
  if (!session) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/barang/[id]
 * Get specific item by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/barang/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      const barang = await inventoryRepository.findBarangDetail(id)

      if (!barang) {
        return ApiErrors.notFound('Barang')
      }

      // Calculate total stock
      let totalStock = 0
      if (barang.barangGudang) {
        totalStock = barang.barangGudang.reduce((sum: number, stock: { stok: number }) => sum + stock.stok, 0)
      }

      const barangWithStats = {
        ...barang,
        totalStock
      }

      logger.dbOperation('findUnique', 'Barang+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', `/api/inventory/barang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        barangId: barang.id,
      })

      return apiSuccess({ barang: barangWithStats })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error
    logger.error('Error fetching barang', err, {
      path: '/api/inventory/barang/[id]',
      method: 'GET',
      id: 'unknown',
    })
    return ApiErrors.internalError('Gagal memuat data barang')
  }
}

/**
 * PUT /api/inventory/barang/[id]
 * Update specific item
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/barang/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
    const body = await req.json()
    const { kode, nama, satuan, isWorkOrderMaterial } = body

    // Validation
    if (!kode || !nama || !satuan) {
      return apiError('Kode, nama, dan satuan barang harus diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      // Check if barang exists
      const existingBarang = await inventoryRepository.findBarangById(id)

      if (!existingBarang) {
        return ApiErrors.notFound('Barang')
      }

      // Check if kode conflicts with another barang
      const kodeConflict = await inventoryRepository.findBarangByKode(kode)

      if (kodeConflict && kodeConflict.id !== id) {
        return apiError('Kode barang sudah digunakan', ErrorCodes.VALIDATION_ERROR, { status: 400 })
      }

      const updatedBarang = await inventoryRepository.updateBarang(id, {
        kode,
        nama,
        satuan,
        isWorkOrderMaterial,
        jenis: body.jenis,
        kategoriAset: body.kategoriAset
      })

      logger.dbOperation('update', 'Barang', Date.now() - dbStart)

      logger.apiRequest('PUT', `/api/inventory/barang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        barangId: updatedBarang.id,
      })

      // System Log
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'Barang',
        userId: session.user.id,
        details: { id: updatedBarang.id, changes: { kode, nama, satuan } }
      })

      return apiSuccess({ barang: updatedBarang }, { message: 'Barang berhasil diperbarui' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error
    logger.error('Error updating barang', err, {
      path: '/api/inventory/barang/[id]',
      method: 'PUT',
      id: 'unknown',
    })
    return ApiErrors.internalError('Gagal mengupdate barang')
  }
}

/**
 * DELETE /api/inventory/barang/[id]
 * Delete specific item
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to DELETE /api/inventory/barang/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    try {
      const dbStart = Date.now()

      // Check if barang exists
      const existingBarang = await inventoryRepository.findBarangById(id)

      if (!existingBarang) {
        return ApiErrors.notFound('Barang')
      }

      // Safe delete via repository
      await inventoryRepository.deleteBarang(id)

      logger.dbOperation('delete', 'Barang', Date.now() - dbStart)

      logger.apiRequest('DELETE', `/api/inventory/barang/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        barangId: id,
      })

      // System Log
      await logger.logActivity({
        action: 'DELETE',
        subject: 'Barang',
        userId: session.user.id,
        details: { id }
      })

      return apiSuccess(null, { message: 'Barang berhasil dihapus' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error
    logger.error('Error deleting barang', err, {
      path: '/api/inventory/barang/[id]',
      method: 'DELETE',
    })
    return ApiErrors.internalError('Gagal menghapus barang')
  }
}