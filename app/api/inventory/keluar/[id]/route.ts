import { NextRequest } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authConfig, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { apiError, apiSuccess, ApiErrors, ErrorCodes } from '@/lib/api-response'
import { hasPermission } from '@/lib/rbac'
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
 * Validate site access for keluar record
 */
async function validateKeluarSiteAccess(
  keluarId: string,
  user: UserSession,
  permissions: string[]
): Promise<{ allowed: boolean; record?: unknown; error?: string }> {
  const isSuper = isSuperAdmin(user)
  if (isSuper) {
    const record = await prisma.barangKeluar.findUnique({
      where: { id: keluarId },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true, sites: { select: { id: true } } } }
      }
    })
    return record ? { allowed: true, record } : { allowed: false, error: 'Record tidak ditemukan' }
  }

  // Check site restriction
  const hasSiteRestriction = permissions.includes('keluar:site_only') ||
    permissions.includes('k_barang:site_only') ||
    permissions.includes('gudang:site_only')

  const record = await prisma.barangKeluar.findUnique({
    where: { id: keluarId },
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
 * GET /api/inventory/keluar/[id]
 * Get specific stock-out record by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const auth = await requireAdmin()
    if (!auth) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/keluar/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { user } = auth

    // Permission check
    if (!await hasPermission('keluar:read', user)) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data barang keluar')
    }

    const { id } = await params
    const permissions = await getUserPermissions(user.id)

    // Validate site access
    const accessCheck = await validateKeluarSiteAccess(id, user, permissions)
    if (!accessCheck.allowed) {
      if (accessCheck.error === 'Record tidak ditemukan') {
        return ApiErrors.notFound('Record barang keluar')
      }
      return ApiErrors.forbidden(accessCheck.error || 'Akses ditolak')
    }

    logger.apiRequest('GET', '/api/inventory/keluar/[id]', 200, Date.now() - startTime, {
      userId: user.id,
      keluarId: id,
    })

    return apiSuccess({ keluar: accessCheck.record })
  } catch (error) {
    const err = error as Error
    logger.error('Error fetching barang keluar', err, {
      path: '/api/inventory/keluar/[id]',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal memuat data barang keluar')
  }
}

/**
 * PUT /api/inventory/keluar/[id]
 * Update stock-out record
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const auth = await requireAdmin()
    if (!auth) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/keluar/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { user } = auth

    // Permission check
    if (!await hasPermission('keluar:update', user)) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah data barang keluar')
    }

    const { id } = await params
    const permissions = await getUserPermissions(user.id)

    // Validate site access before allowing update
    const accessCheck = await validateKeluarSiteAccess(id, user, permissions)
    if (!accessCheck.allowed) {
      if (accessCheck.error === 'Record tidak ditemukan') {
        return ApiErrors.notFound('Record barang keluar')
      }
      return ApiErrors.forbidden(accessCheck.error || 'Akses ditolak')
    }

    const body = await req.json()
    const { jumlah, keterangan } = body

    // Validation
    if (!jumlah || jumlah <= 0) {
      return apiError('Jumlah harus diisi dengan angka positif', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    try {
      const dbStart = Date.now()

      const transactionResult = await prisma.$transaction(async (tx) => {
        // Get current record
        const currentRecord = await tx.barangKeluar.findUnique({
          where: { id },
          include: {
            barang: true,
            gudang: true
          }
        })

        if (!currentRecord) {
          throw new Error('Record barang keluar tidak ditemukan')
        }

        // Calculate stock difference
        const stockDifference = currentRecord.jumlah - jumlah

        // Update the record
        await tx.barangKeluar.update({
          where: { id },
          data: {
            jumlah,
            keterangan
          }
        })

        // Update stock in BarangGudang
        const currentStock = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId: currentRecord.barangId, gudangId: currentRecord.gudangId } }
        })

        if (currentStock) {
          const newStock = currentStock.stok + stockDifference
          if (newStock < 0) {
            throw new Error('Stok tidak mencukupi untuk perubahan ini')
          }

          const stockField = STOCK_FIELD_MAP[currentRecord.kondisi as keyof typeof STOCK_FIELD_MAP] || 'stokBaru'
          const newConditionStock = Number((currentStock as Record<string, unknown>)[stockField] || 0) + stockDifference

          if (newConditionStock < 0) {
            throw new Error(`Stok ${currentRecord.kondisi} tidak mencukupi untuk perubahan ini`)
          }

          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId: currentRecord.barangId, gudangId: currentRecord.gudangId } },
            data: {
              stok: newStock,
              [stockField]: newConditionStock
            }
          })
        } else {
          throw new Error('Stok tidak ditemukan untuk barang dan gudang ini')
        }

        logger.dbOperation('transaction', 'BarangKeluar+BarangGudang', Date.now() - dbStart)
        return { barangNama: currentRecord.barang.nama, jumlahLama: currentRecord.jumlah }
      })

      logger.apiRequest('PUT', '/api/inventory/keluar/[id]', 200, Date.now() - startTime, {
        userId: user.id,
        keluarId: id,
        jumlah,
      })

      // Log activity
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'Inventory Out (Admin)',
        details: {
          id,
          namaBarang: transactionResult.barangNama,
          jumlahLama: transactionResult.jumlahLama,
          jumlahBaru: jumlah,
          keterangan
        },
        userId: user.id
      })

      return apiSuccess(null, { message: 'Barang keluar berhasil diperbarui' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error
    logger.error('Error updating barang keluar', err, {
      path: '/api/inventory/keluar/[id]',
      method: 'PUT',
    })

    if (err.message === 'Record barang keluar tidak ditemukan') {
      return ApiErrors.notFound('Record barang keluar')
    }
    if (err.message === 'Stok tidak mencukupi untuk perubahan ini') {
      return apiError('Stok tidak mencukupi untuk perubahan ini', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    return ApiErrors.internalError('Gagal memperbarui barang keluar')
  }
}

/**
 * DELETE /api/inventory/keluar/[id]
 * Delete stock-out record and restore stock
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  try {
    const auth = await requireAdmin()
    if (!auth) {
      logger.warn('Unauthorized access attempt to DELETE /api/inventory/keluar/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { user } = auth

    // Permission check
    if (!await hasPermission('keluar:delete', user)) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus data barang keluar')
    }

    const { id } = await params
    const permissions = await getUserPermissions(user.id)

    // Validate site access before allowing delete
    const accessCheck = await validateKeluarSiteAccess(id, user, permissions)
    if (!accessCheck.allowed) {
      if (accessCheck.error === 'Record tidak ditemukan') {
        return ApiErrors.notFound('Record barang keluar')
      }
      return ApiErrors.forbidden(accessCheck.error || 'Akses ditolak')
    }

    try {
      const dbStart = Date.now()

      const transactionResult = await prisma.$transaction(async (tx) => {
        // Get the record to be deleted
        const keluarRecord = await tx.barangKeluar.findUnique({
          where: { id },
          include: {
            barang: true,
            gudang: true
          }
        })

        if (!keluarRecord) {
          throw new Error('Record barang keluar tidak ditemukan')
        }

        // Restore stock to BarangGudang
        const currentStock = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId: keluarRecord.barangId, gudangId: keluarRecord.gudangId } }
        })

        if (currentStock) {
          const stockField = STOCK_FIELD_MAP[keluarRecord.kondisi as keyof typeof STOCK_FIELD_MAP] || 'stokBaru'
          const newConditionStock = Number((currentStock as Record<string, unknown>)[stockField] || 0) + keluarRecord.jumlah

          // Add back the stock that was taken out
          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId: keluarRecord.barangId, gudangId: keluarRecord.gudangId } },
            data: {
              stok: currentStock.stok + keluarRecord.jumlah,
              [stockField]: newConditionStock
            }
          })
        } else {
          // If no stock record exists, create one
          const stockField = STOCK_FIELD_MAP[keluarRecord.kondisi as keyof typeof STOCK_FIELD_MAP] || 'stokBaru'

          await tx.barangGudang.create({
            data: {
              id: crypto.randomUUID(),
              barangId: keluarRecord.barangId,
              gudangId: keluarRecord.gudangId,
              stok: keluarRecord.jumlah,
              [stockField]: keluarRecord.jumlah,
              updatedAt: new Date()
            }
          })
        }

        // Delete the record
        await tx.barangKeluar.delete({
          where: { id }
        })

        logger.dbOperation('transaction', 'BarangKeluar+BarangGudang', Date.now() - dbStart)
        return { barangNama: keluarRecord.barang.nama, jumlah: keluarRecord.jumlah }
      })

      logger.apiRequest('DELETE', '/api/inventory/keluar/[id]', 200, Date.now() - startTime, {
        userId: user.id,
        keluarId: id,
      })

      // Log activity
      await logger.logActivity({
        action: 'DELETE',
        subject: 'Inventory Out (Admin)',
        details: {
          id,
          namaBarang: transactionResult.barangNama,
          jumlahRestored: transactionResult.jumlah
        },
        userId: user.id
      })

      return apiSuccess(null, { message: 'Record barang keluar berhasil dihapus dan stok dikembalikan' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error) {
    const err = error as Error
    logger.error('Error deleting barang keluar', err, {
      path: '/api/inventory/keluar/[id]',
      method: 'DELETE',
    })

    if (err.message === 'Record barang keluar tidak ditemukan') {
      return ApiErrors.notFound('Record barang keluar')
    }

    return ApiErrors.internalError('Gagal menghapus record barang keluar')
  }
}
