import { NextRequest } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authConfig, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { hasPermission } from '@/lib/rbac'
import { apiError, apiSuccess, ApiErrors, ErrorCodes } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { STOCK_FIELD_MAP } from '@/lib/constants/inventory'

interface UserSession {
  id: string
  siteId?: string | null
  role?: string
  isSuperAdmin?: boolean
}

async function requireAdmin(): Promise<{ session: Session; user: UserSession } | null> {
  const session = await getServerSession(authConfig) as Session | null
  if (!session?.user) {
    return null
  }
  return { session, user: session.user as UserSession }
}

/**
 * Validate site access for masuk record
 * Returns the record if user has access, null otherwise
 */
async function validateMasukSiteAccess(
  masukId: string,
  user: UserSession,
  permissions: string[]
): Promise<{ allowed: boolean; record?: unknown; error?: string }> {
  const isSuper = isSuperAdmin(user)
  if (isSuper) {
    const record = await prisma.barangMasuk.findUnique({
      where: { id: masukId },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true, sites: { select: { id: true } } } }
      }
    })
    return record ? { allowed: true, record } : { allowed: false, error: 'Record tidak ditemukan' }
  }

  // Check site restriction
  const hasSiteRestriction = permissions.includes('masuk:site_only') ||
    permissions.includes('k_barang:site_only') ||
    permissions.includes('gudang:site_only')

  const record = await prisma.barangMasuk.findUnique({
    where: { id: masukId },
    include: {
      barang: { select: { id: true, kode: true, nama: true, satuan: true } },
      gudang: { select: { id: true, kode: true, nama: true, sites: { select: { id: true } } } }
    }
  })

  if (!record) {
    return { allowed: false, error: 'Record tidak ditemukan' }
  }

  if (hasSiteRestriction && user.siteId) {
    const gudangSiteIds = record.gudang.sites?.map((s: { id: string }) => s.id) || []
    if (!gudangSiteIds.includes(user.siteId)) {
      return { allowed: false, error: 'Anda tidak memiliki akses ke data ini' }
    }
  }

  return { allowed: true, record }
}

/**
 * GET /api/inventory/masuk/[id]
 * Get specific stock-in record by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const auth = await requireAdmin()
    if (!auth) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/masuk/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { user } = auth

    // Permission check
    if (!await hasPermission('masuk:read', user)) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data barang masuk')
    }

    const { id } = await params
    const permissions = await getUserPermissions(user.id)

    // Validate site access
    const accessCheck = await validateMasukSiteAccess(id, user, permissions)
    if (!accessCheck.allowed) {
      if (accessCheck.error === 'Record tidak ditemukan') {
        return ApiErrors.notFound('Record barang masuk')
      }
      return ApiErrors.forbidden(accessCheck.error || 'Akses ditolak')
    }

    logger.apiRequest('GET', '/api/inventory/masuk/[id]', 200, Date.now() - startTime, {
      userId: user.id,
      masukId: id,
    })

    return apiSuccess({ masuk: accessCheck.record })
  } catch (error) {
    const err = error as Error
    logger.error('Error fetching barang masuk', err, {
      path: '/api/inventory/masuk/[id]',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data barang masuk')
  }
}

/**
 * PUT /api/inventory/masuk/[id]
 * Update stock-in record
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const auth = await requireAdmin()
    if (!auth) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/masuk/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { user } = auth

    // Permission check
    if (!await hasPermission('masuk:update', user)) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah data barang masuk')
    }

    const { id } = await params
    const permissions = await getUserPermissions(user.id)

    // Validate site access before allowing update
    const accessCheck = await validateMasukSiteAccess(id, user, permissions)
    if (!accessCheck.allowed) {
      if (accessCheck.error === 'Record tidak ditemukan') {
        return ApiErrors.notFound('Record barang masuk')
      }
      return ApiErrors.forbidden(accessCheck.error || 'Akses ditolak')
    }

    const body = await req.json()
    const { jumlah, kondisi, keterangan } = body

    // Validation
    if (!jumlah || jumlah <= 0) {
      return apiError('Jumlah harus diisi dengan angka positif', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    try {
      const dbStart = Date.now()

      await prisma.$transaction(async (tx) => {
        // Get current record
        const currentRecord = await tx.barangMasuk.findUnique({
          where: { id },
          include: {
            barang: true,
            gudang: true
          }
        })

        if (!currentRecord) {
          throw new Error('Record barang masuk tidak ditemukan')
        }

        // Calculate stock difference
        const stockDifference = jumlah - currentRecord.jumlah

        // Update the record
        await tx.barangMasuk.update({
          where: { id },
          data: {
            jumlah,
            kondisi: kondisi || currentRecord.kondisi,
            keterangan
          }
        })

        // Update stock in BarangGudang
        const currentStock = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId: currentRecord.barangId, gudangId: currentRecord.gudangId } }
        })

        if (currentStock) {
          const newTotalStock = currentStock.stok + stockDifference
          if (newTotalStock < 0) {
            throw new Error('Stok tidak bisa negatif')
          }

          const oldKondisi = currentRecord.kondisi as keyof typeof STOCK_FIELD_MAP
          const newKondisi = (kondisi || currentRecord.kondisi) as keyof typeof STOCK_FIELD_MAP
          const oldStockField = STOCK_FIELD_MAP[oldKondisi] || 'stokBaru'
          const newStockField = STOCK_FIELD_MAP[newKondisi] || 'stokBaru'

          const updateData: Record<string, number> = { stok: newTotalStock }

          if (oldStockField === newStockField) {
            const newConditionStock = Number((currentStock as Record<string, unknown>)[oldStockField] || 0) + stockDifference
            if (newConditionStock < 0) throw new Error(`Stok ${newKondisi} tidak bisa negatif`)
            updateData[newStockField] = newConditionStock
          } else {
            const oldConditionStock = Number((currentStock as Record<string, unknown>)[oldStockField] || 0) - currentRecord.jumlah
            if (oldConditionStock < 0) throw new Error(`Stok ${oldKondisi} tidak bisa negatif`)

            const newConditionStock = Number((currentStock as Record<string, unknown>)[newStockField] || 0) + jumlah
            updateData[oldStockField] = oldConditionStock
            updateData[newStockField] = newConditionStock
          }

          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId: currentRecord.barangId, gudangId: currentRecord.gudangId } },
            data: updateData
          })
        } else {
          // If no stock record exists, create one
          const newKondisi = (kondisi || currentRecord.kondisi) as keyof typeof STOCK_FIELD_MAP
          const newStockField = STOCK_FIELD_MAP[newKondisi] || 'stokBaru'

          await tx.barangGudang.create({
            data: {
              id: crypto.randomUUID(),
              barangId: currentRecord.barangId,
              gudangId: currentRecord.gudangId,
              stok: jumlah,
              [newStockField]: jumlah,
              updatedAt: new Date()
            }
          })
        }

        logger.dbOperation('transaction', 'BarangMasuk+BarangGudang', Date.now() - dbStart)
      })

      logger.apiRequest('PUT', '/api/inventory/masuk/[id]', 200, Date.now() - startTime, {
        userId: user.id,
        masukId: id,
        jumlah,
      })

      return apiSuccess(null, { message: 'Barang masuk berhasil diperbarui' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error
    logger.error('Error updating barang masuk', err, {
      path: '/api/inventory/masuk/[id]',
      method: 'PUT',
    })

    if (err.message === 'Record barang masuk tidak ditemukan') {
      return ApiErrors.notFound('Record barang masuk')
    }
    if (err.message === 'Stok tidak bisa negatif') {
      return apiError('Stok tidak bisa negatif', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    return ApiErrors.internalError('Gagal memperbarui barang masuk')
  }
}

/**
 * DELETE /api/inventory/masuk/[id]
 * Delete stock-in record and reduce stock
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const auth = await requireAdmin()
    if (!auth) {
      logger.warn('Unauthorized access attempt to DELETE /api/inventory/masuk/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { user } = auth

    // Permission check
    if (!await hasPermission('masuk:delete', user)) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus data barang masuk')
    }

    const { id } = await params
    const permissions = await getUserPermissions(user.id)

    // Validate site access before allowing delete
    const accessCheck = await validateMasukSiteAccess(id, user, permissions)
    if (!accessCheck.allowed) {
      if (accessCheck.error === 'Record tidak ditemukan') {
        return ApiErrors.notFound('Record barang masuk')
      }
      return ApiErrors.forbidden(accessCheck.error || 'Akses ditolak')
    }

    try {
      const dbStart = Date.now()

      await prisma.$transaction(async (tx) => {
        // Get the record to be deleted
        const masukRecord = await tx.barangMasuk.findUnique({
          where: { id },
          include: {
            barang: true,
            gudang: true
          }
        })

        if (!masukRecord) {
          throw new Error('Record barang masuk tidak ditemukan')
        }

        // Reduce stock from BarangGudang
        const currentStock = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId: masukRecord.barangId, gudangId: masukRecord.gudangId } }
        })

        if (currentStock) {
          const newStock = Math.max(0, currentStock.stok - masukRecord.jumlah)
          const stockField = STOCK_FIELD_MAP[masukRecord.kondisi as keyof typeof STOCK_FIELD_MAP] || 'stokBaru'

          if (newStock === 0) {
            // If stock becomes 0, delete the BarangGudang record
            await tx.barangGudang.delete({
              where: { barangId_gudangId: { barangId: masukRecord.barangId, gudangId: masukRecord.gudangId } }
            })
          } else {
            // Update with reduced stock
            const newConditionStock = Math.max(0, Number((currentStock as Record<string, unknown>)[stockField] || 0) - masukRecord.jumlah)
            await tx.barangGudang.update({
              where: { barangId_gudangId: { barangId: masukRecord.barangId, gudangId: masukRecord.gudangId } },
              data: {
                stok: newStock,
                [stockField]: newConditionStock
              }
            })
          }
        }

        // Delete the record
        await tx.barangMasuk.delete({
          where: { id }
        })

        logger.dbOperation('transaction', 'BarangMasuk+BarangGudang', Date.now() - dbStart)
      })

      logger.apiRequest('DELETE', '/api/inventory/masuk/[id]', 200, Date.now() - startTime, {
        userId: user.id,
        masukId: id,
      })

      return apiSuccess(null, { message: 'Record barang masuk berhasil dihapus dan stok dikurangi' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error
    logger.error('Error deleting barang masuk', err, {
      path: '/api/inventory/masuk/[id]',
      method: 'DELETE',
    })

    if (err.message === 'Record barang masuk tidak ditemukan') {
      return ApiErrors.notFound('Record barang masuk')
    }

    return ApiErrors.internalError('Gagal menghapus record barang masuk')
  }
}