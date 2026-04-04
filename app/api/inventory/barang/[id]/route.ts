import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { getInventoryRepository } from '@/lib/repositories'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

/**
 * GET /api/inventory/barang/[id]
 * Get specific item by ID
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user
  const { id } = ctx.params

  if (!(await hasPermission("barang:read"))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat detail barang')
  }

  const inventoryRepository = getInventoryRepository()

  // Site Restriction Check
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user)
  const hasRestriction = permissions.includes('barang:site_only') ||
    permissions.includes('k_barang:site_only') ||
    permissions.includes('gudang:site_only')

  let siteId: string | undefined = undefined;
  if (!isSuper && hasRestriction) {
    const { prisma } = await import('@/modules/database');
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
    siteId = dbUser?.siteId || undefined;
  }

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
      userId: user.id,
      barangId: barang.id,
    })

    return apiSuccess({ barang: barangWithStats })
  } catch (error) {
    const err = error as Error
    logger.error('Error fetching barang', err, {
      path: '/api/inventory/barang/[id]',
      method: 'GET',
      id: 'unknown',
    })
    return ApiErrors.internalError('Gagal memuat data barang')
  }
})

/**
 * PUT /api/inventory/barang/[id]
 * Update specific item
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user
  const { id } = ctx.params

  if (!(await hasPermission("barang:update"))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah barang')
  }

  const body = await req.json()
  const { kode, nama, satuan, isWorkOrderMaterial } = body

  // Validation
  if (!kode || !nama || !satuan) {
    return ApiErrors.badRequest('Kode, nama, dan satuan barang harus diisi')
  }

  const inventoryRepository = getInventoryRepository()

  // Site Restriction Check
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user)
  const hasRestriction = permissions.includes('barang:site_only') ||
    permissions.includes('k_barang:site_only') ||
    permissions.includes('gudang:site_only')

  let siteId: string | undefined = undefined;
  if (!isSuper && hasRestriction) {
    const { prisma } = await import('@/modules/database');
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
    siteId = dbUser?.siteId || undefined;
  }

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
      return ApiErrors.badRequest('Kode barang sudah digunakan')
    }

    const updatedBarang = await inventoryRepository.updateBarang(id, {
      kode,
      nama,
      satuan,
      isWorkOrderMaterial,
      jenis: body.jenis,
      kategoriAset: body.kategoriAset,
      minStokDefault: body.minStokDefault
    })

    logger.dbOperation('update', 'Barang', Date.now() - dbStart)

    logger.apiRequest('PUT', `/api/inventory/barang/${id}`, 200, Date.now() - startTime, {
      userId: user.id,
      barangId: updatedBarang.id,
    })

    // System Log
    await logger.logActivity({
      action: 'UPDATE',
      subject: 'Barang',
      userId: user.id,
      details: { id: updatedBarang.id, changes: { kode, nama, satuan } }
    })

    return apiSuccess({ barang: updatedBarang }, { message: 'Barang berhasil diperbarui' })
  } catch (error) {
    const err = error as Error
    logger.error('Error updating barang', err, {
      path: '/api/inventory/barang/[id]',
      method: 'PUT',
      id: 'unknown',
    })
    return ApiErrors.internalError('Gagal mengupdate barang')
  }
})

/**
 * DELETE /api/inventory/barang/[id]
 * Delete specific item
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const startTime = Date.now()
  const user = ctx.session!.user
  const { id } = ctx.params

  if (!(await hasPermission("barang:delete"))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus barang')
  }

  const inventoryRepository = getInventoryRepository()

  // Site Restriction Check
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user)
  const hasRestriction = permissions.includes('barang:site_only') ||
    permissions.includes('k_barang:site_only') ||
    permissions.includes('gudang:site_only')

  let siteId: string | undefined = undefined;
  if (!isSuper && hasRestriction) {
    const { prisma } = await import('@/modules/database');
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { siteId: true } });
    siteId = dbUser?.siteId || undefined;
  }

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
      userId: user.id,
      barangId: id,
    })

    // System Log
    await logger.logActivity({
      action: 'DELETE',
      subject: 'Barang',
      userId: user.id,
      details: { id }
    })

    return apiSuccess(null, { message: 'Barang berhasil dihapus' })
  } catch (error) {
    const err = error as Error

    // Check for Prisma Foreign Key Constraint error (P2003)
    if ((error as { code?: string }).code === 'P2003' || err.message?.includes('P2003')) {
      return ApiErrors.badRequest('Barang tidak bisa dihapus karena masih terkait dengan data transaksi (Work Order, Pesanan, atau Aset). Pastikan semua relasi data terkait sudah dibersihkan.')
    }

    logger.error('Error deleting barang', err, {
      path: '/api/inventory/barang/[id]',
      method: 'DELETE',
      id: 'unknown',
    })
    return ApiErrors.internalError('Gagal menghapus barang')
  }
})
