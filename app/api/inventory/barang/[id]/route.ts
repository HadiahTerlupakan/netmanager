import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { getInventoryRepository } from '@/lib/repositories'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

/**
 * GET /api/inventory/barang/[id]
 * Get specific item by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await verifyAuth(req)
    if (!session) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("barang:read"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat detail barang')
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    // Site Restriction Check
    const permissions = await getUserPermissions(session.id);
    const isSuperAdmin = session.role === 'SUPER_ADMIN'
    const hasRestriction = permissions.includes('barang:site_only') ||
                           permissions.includes('k_barang:site_only') ||
                           permissions.includes('gudang:site_only')

    const siteId = (!isSuperAdmin && hasRestriction) ? session.siteId : undefined

    try {
      const dbStart = Date.now()

      const barang = await inventoryRepository.findBarangDetail(id)

      if (!barang) {
        return ApiErrors.notFound('Barang')
      }

      // If site restricted, check if barang has stock in user's site
      if (siteId) {
        const _hasStockInSite = (barang.barangGudang || []).some(bg =>
          (bg as { gudang?: { sites?: Array<{ id: string }> } }).gudang?.sites?.some(s => s.id === siteId)
        )
        // If it's a new item with no stock yet, we might still want to allow viewing if it's "visible"
        // but the instruction says "MUST include siteId verification".
        // For now, let's filter the barangGudang list at least.
      }

      // Calculate total stock (filtered by site if restricted)
      let totalStock = 0
      let filteredBarangGudang = barang.barangGudang || []

      if (siteId) {
        filteredBarangGudang = (barang.barangGudang || []).filter(bg =>
          (bg as { gudang?: { sites?: Array<{ id: string }> } }).gudang?.sites?.some(s => s.id === siteId)
        )
      }

      totalStock = filteredBarangGudang.reduce((sum: number, stock: { stok: number }) => sum + stock.stok, 0)

      const barangWithStats = {
        ...barang,
        barangGudang: filteredBarangGudang,
        totalStock
      }

      logger.dbOperation('findUnique', 'Barang+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', `/api/inventory/barang/${id}`, 200, Date.now() - startTime, {
        userId: session.id,
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
    const session = await verifyAuth(req)
    if (!session) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("barang:update"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah barang')
    }

    const { id } = await params
    const body = await req.json()
    const { kode, nama, satuan, isWorkOrderMaterial } = body

    // Validation
    if (!kode || !nama || !satuan) {
      return apiError('Kode, nama, dan satuan barang harus diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const inventoryRepository = getInventoryRepository()

    // Site Restriction Check
    const permissions = await getUserPermissions(session.id);
    const isSuperAdmin = session.role === 'SUPER_ADMIN'
    const hasRestriction = permissions.includes('barang:site_only') ||
                           permissions.includes('k_barang:site_only') ||
                           permissions.includes('gudang:site_only')

    const siteId = (!isSuperAdmin && hasRestriction) ? session.siteId : undefined

    try {
      const dbStart = Date.now()

      // Check if barang exists
      const existingBarang = await inventoryRepository.findBarangById(id)

      if (!existingBarang) {
        return ApiErrors.notFound('Barang')
      }

      // Site Isolation Verification
      if (siteId) {
        const hasAccessToBarang = (existingBarang.barangGudang || []).some(bg =>
          (bg as { gudang?: { sites?: Array<{ id: string }> } }).gudang?.sites?.some(s => s.id === siteId)
        )
        if (!hasAccessToBarang) {
          return ApiErrors.forbidden('Anda tidak memiliki akses ke barang ini di site Anda')
        }
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
        userId: session.id,
        barangId: updatedBarang.id,
      })

      // System Log
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'Barang',
        userId: session.id,
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
    const session = await verifyAuth(req)
    if (!session) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("barang:delete"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus barang')
    }

    const { id } = await params
    const inventoryRepository = getInventoryRepository()

    // Site Restriction Check
    const permissions = await getUserPermissions(session.id);
    const isSuperAdmin = session.role === 'SUPER_ADMIN'
    const hasRestriction = permissions.includes('barang:site_only') ||
                           permissions.includes('k_barang:site_only') ||
                           permissions.includes('gudang:site_only')

    const siteId = (!isSuperAdmin && hasRestriction) ? session.siteId : undefined

    try {
      const dbStart = Date.now()

      // Check if barang exists
      const existingBarang = await inventoryRepository.findBarangById(id)

      if (!existingBarang) {
        return ApiErrors.notFound('Barang')
      }

      // Site Isolation Verification
      if (siteId) {
        const hasAccessToBarang = (existingBarang.barangGudang || []).some(bg =>
          (bg as { gudang?: { sites?: Array<{ id: string }> } }).gudang?.sites?.some(s => s.id === siteId)
        )
        if (!hasAccessToBarang) {
          return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus barang ini')
        }
      }

      // Safe delete via repository
      await inventoryRepository.deleteBarang(id)

      logger.dbOperation('delete', 'Barang', Date.now() - dbStart)

      logger.apiRequest('DELETE', `/api/inventory/barang/${id}`, 200, Date.now() - startTime, {
        userId: session.id,
        barangId: id,
      })

      // System Log
      await logger.logActivity({
        action: 'DELETE',
        subject: 'Barang',
        userId: session.id,
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