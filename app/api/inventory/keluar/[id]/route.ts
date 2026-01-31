import { NextRequest } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

async function requireAdmin() {
  const session = await getServerSession(authConfig) as Session | null
  if (!session) {
    return null
  }
  return session
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
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/keluar/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
    try {
      const dbStart = Date.now()

      const keluarRecord = await prisma.barangKeluar.findUnique({
        where: { id },
        include: {
          barang: {
            select: {
              id: true,
              kode: true,
              nama: true,
              satuan: true
            }
          },
          gudang: {
            select: {
              id: true,
              kode: true,
              nama: true
            }
          }
        }
      })

      logger.dbOperation('findUnique', 'BarangKeluar+Relations', Date.now() - dbStart)

      if (!keluarRecord) {
        return ApiErrors.notFound('Record barang keluar')
      }

      logger.apiRequest('GET', '/api/inventory/keluar/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        keluarId: id,
      })

      return apiSuccess({ keluar: keluarRecord })
    } finally {
      // do not disconnect shared prisma client
    }
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
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/keluar/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
    const body = await req.json()
    const { jumlah, keterangan } = body

    // Validation
    if (!jumlah || jumlah <= 0) {
      return apiError('Jumlah harus diisi dengan angka positif', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    try {
      const dbStart = Date.now()

      await prisma.$transaction(async (tx) => {
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

          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId: currentRecord.barangId, gudangId: currentRecord.gudangId } },
            data: { stok: newStock }
          })
        } else {
          throw new Error('Stok tidak ditemukan untuk barang dan gudang ini')
        }

        logger.dbOperation('transaction', 'BarangKeluar+BarangGudang', Date.now() - dbStart)
      })

      logger.apiRequest('PUT', '/api/inventory/keluar/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        keluarId: id,
        jumlah,
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
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to DELETE /api/inventory/keluar/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
    try {
      const dbStart = Date.now()

      await prisma.$transaction(async (tx) => {
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
          // Add back the stock that was taken out
          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId: keluarRecord.barangId, gudangId: keluarRecord.gudangId } },
            data: {
              stok: currentStock.stok + keluarRecord.jumlah
            }
          })
        } else {
          // If no stock record exists, create one
          await tx.barangGudang.create({
            data: {
              id: crypto.randomUUID(),
              barangId: keluarRecord.barangId,
              gudangId: keluarRecord.gudangId,
              stok: keluarRecord.jumlah,
              updatedAt: new Date()
            }
          })
        }

        // Delete the record
        await tx.barangKeluar.delete({
          where: { id }
        })

        logger.dbOperation('transaction', 'BarangKeluar+BarangGudang', Date.now() - dbStart)
      })

      logger.apiRequest('DELETE', '/api/inventory/keluar/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        keluarId: id,
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