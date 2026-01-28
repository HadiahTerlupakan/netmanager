import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
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
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/masuk/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
    try {
      const dbStart = Date.now()

      const masukRecord = await prisma.barangMasuk.findUnique({
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

      logger.dbOperation('findUnique', 'BarangMasuk+Relations', Date.now() - dbStart)

      if (!masukRecord) {
        return ApiErrors.notFound('Record barang masuk')
      }

      logger.apiRequest('GET', '/api/inventory/masuk/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        masukId: id,
      })

      return apiSuccess({ masuk: masukRecord })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching barang masuk', error, {
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
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/masuk/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
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
          const newStock = currentStock.stok + stockDifference
          if (newStock < 0) {
            throw new Error('Stok tidak bisa negatif')
          }

          await tx.barangGudang.update({
            where: { barangId_gudangId: { barangId: currentRecord.barangId, gudangId: currentRecord.gudangId } },
            data: { stok: newStock }
          })
        } else {
          // If no stock record exists, create one
          await tx.barangGudang.create({
            data: {
              id: crypto.randomUUID(),
              barangId: currentRecord.barangId,
              gudangId: currentRecord.gudangId,
              stok: jumlah,
              updatedAt: new Date()
            }
          })
        }

        logger.dbOperation('transaction', 'BarangMasuk+BarangGudang', Date.now() - dbStart)
      })

      logger.apiRequest('PUT', '/api/inventory/masuk/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        masukId: id,
        jumlah,
      })

      return apiSuccess(null, { message: 'Barang masuk berhasil diperbarui' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error updating barang masuk', error, {
      path: '/api/inventory/masuk/[id]',
      method: 'PUT',
    })

    if (error.message === 'Record barang masuk tidak ditemukan') {
      return ApiErrors.notFound('Record barang masuk')
    }
    if (error.message === 'Stok tidak bisa negatif') {
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
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to DELETE /api/inventory/masuk/[id]')
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
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

          if (newStock === 0) {
            // If stock becomes 0, delete the BarangGudang record
            await tx.barangGudang.delete({
              where: { barangId_gudangId: { barangId: masukRecord.barangId, gudangId: masukRecord.gudangId } }
            })
          } else {
            // Update with reduced stock
            await tx.barangGudang.update({
              where: { barangId_gudangId: { barangId: masukRecord.barangId, gudangId: masukRecord.gudangId } },
              data: { stok: newStock }
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
        userId: session.user.id,
        masukId: id,
      })

      return apiSuccess(null, { message: 'Record barang masuk berhasil dihapus dan stok dikurangi' })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error deleting barang masuk', error, {
      path: '/api/inventory/masuk/[id]',
      method: 'DELETE',
    })

    if (error.message === 'Record barang masuk tidak ditemukan') {
      return ApiErrors.notFound('Record barang masuk')
    }

    return ApiErrors.internalError('Gagal menghapus record barang masuk')
  }
}