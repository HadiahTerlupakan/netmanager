import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { hasPermission } from '@/lib/rbac'

// Auth helpers unified in route handlers

/**
 * GET /api/inventory/opname/[id]
 * Get single stock opname record by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authConfig)
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/opname/[id]')
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("opname:read"))) {
      return ApiErrors.forbidden()
    }

        const { id } = await params
        try {
      const dbStart = Date.now()

      const opnameRecord = await prisma.stockOpname.findUnique({
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
              nama: true,
              lokasi: true
            }
          }
        }
      })

      if (!opnameRecord) {
        return ApiErrors.notFound('Record stock opname tidak ditemukan')
      }

      logger.dbOperation('findUnique', 'StockOpname+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/opname/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        opnameId: id,
      })

      return apiSuccess(opnameRecord)
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan')
    logger.error('Error fetching stock opname record', err, {
      path: '/api/inventory/opname/[id]',
      method: 'GET',
      id: 'unknown',
    })
    return ApiErrors.internalError('Gagal memuat data stock opname')
  }
}

/**
 * PUT /api/inventory/opname/[id]
 * Update stock opname record
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authConfig)
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/opname/[id]')
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("opname:update"))) {
      return ApiErrors.forbidden()
    }

        const { id } = await params
    const body = await req.json()
    const {
      stokFisik,
      keterangan,
      kondisiBaik,
      kondisiRusak,
      kondisiExpire,
      lokasiPenyimpanan,
      nomorRak,
      nomorBox,
      pic,
      suhuPenyimpanan,
      kelembaban,
      tanggalExpire,
      nomorBatch,
      catatanDetail
    } = body

    // Validation
    if (stokFisik === undefined || stokFisik < 0) {
      return ApiErrors.badRequest('Stok fisik harus berupa angka non-negatif')
    }

    // Validate condition breakdown
    if (kondisiBaik !== undefined && kondisiRusak !== undefined && kondisiExpire !== undefined) {
      const totalKondisi = kondisiBaik + kondisiRusak + kondisiExpire
      if (totalKondisi > stokFisik) {
        return ApiErrors.badRequest('Total jumlah kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik')
      }
    }

    try {
      const dbStart = Date.now()
      const result = await prisma.$transaction(async (tx) => {
        // Check if record exists
        const existingRecord = await tx.stockOpname.findUnique({
          where: { id },
          include: {
            barang: true,
            gudang: true
          }
        })

        if (!existingRecord) {
          throw new Error('Record stock opname tidak ditemukan')
        }

        // Get current system stock
        const currentStock = await tx.barangGudang.findUnique({
          where: { barangId_gudangId: { barangId: existingRecord.barangId, gudangId: existingRecord.gudangId } }
        })

        const stokSistem = currentStock?.stok || 0
        const selisih = stokFisik - stokSistem

        // Update stock opname record
        const updatedRecord = await tx.stockOpname.update({
          where: { id },
          data: {
            stokFisik,
            stokSistem,
            selisih,
            keterangan,
            kondisiBaik: kondisiBaik !== undefined ? kondisiBaik : existingRecord.kondisiBaik,
            kondisiRusak: kondisiRusak !== undefined ? kondisiRusak : existingRecord.kondisiRusak,
            kondisiExpire: kondisiExpire !== undefined ? kondisiExpire : existingRecord.kondisiExpire,
            lokasiPenyimpanan,
            nomorRak,
            nomorBox,
            pic,
            suhuPenyimpanan,
            kelembaban,
            tanggalExpire: tanggalExpire ? new Date(tanggalExpire) : existingRecord.tanggalExpire,
            nomorBatch,
            catatanDetail
          }
        })

        // Update stock to match physical count
        if (currentStock) {
          if (stokFisik === 0) {
            // Delete stock record if physical count is 0
            await tx.barangGudang.delete({
              where: { barangId_gudangId: { barangId: existingRecord.barangId, gudangId: existingRecord.gudangId } }
            })
          } else {
            // Update stock record
            await tx.barangGudang.update({
              where: { barangId_gudangId: { barangId: existingRecord.barangId, gudangId: existingRecord.gudangId } },
              data: { stok: stokFisik }
            })
          }
        } else if (stokFisik > 0) {
          // Create new stock record if it doesn't exist
          await tx.barangGudang.create({
            data: {
              id: crypto.randomUUID(),
              barangId: existingRecord.barangId,
              gudangId: existingRecord.gudangId,
              stok: stokFisik,
              updatedAt: new Date()
            }
          })
        }

        logger.dbOperation('transaction', 'StockOpname+BarangGudang', Date.now() - dbStart)

        logger.apiRequest('PUT', '/api/inventory/opname/[id]', 200, Date.now() - startTime, {
          userId: session.user.id,
          opnameId: id,
          stokFisik,
          stokSistem,
          selisih,
        })

        return updatedRecord
      })

      return apiSuccess({
        message: 'Stock opname berhasil diperbarui',
        record: result
      })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan')
    logger.error('Error updating stock opname', err, {
      path: '/api/inventory/opname/[id]',
      method: 'PUT',
      id: 'unknown',
    })

    if (err.message === 'Record stock opname tidak ditemukan') {
      return ApiErrors.notFound(err.message)
    }

    return ApiErrors.internalError('Gagal memperbarui stock opname')
  }
}

/**
 * DELETE /api/inventory/opname/[id]
 * Delete stock opname record
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authConfig)
    if (!session || !session.user) {
      return ApiErrors.unauthorized()
    }

    if (!(await hasPermission("opname:delete"))) {
      return ApiErrors.forbidden()
    }

        const { id } = await params
        // Validate ID
    if (!id || id.trim() === '') {
      return ApiErrors.badRequest('ID tidak valid')
    }

    await prisma.$transaction(async (tx) => {
      // Check if record exists
      const existingRecord = await tx.stockOpname.findUnique({
        where: { id: id.trim() }
      })

      if (!existingRecord) {
        throw new Error('Record stock opname tidak ditemukan')
      }

      // Get current stock record
      const currentStock = await tx.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: existingRecord.barangId,
            gudangId: existingRecord.gudangId
          }
        }
      })

      // Restore stock to previous system stock
      if (currentStock) {
        if (existingRecord.stokSistem === 0) {
          // Delete stock record if system stock was 0
          await tx.barangGudang.delete({
            where: {
              barangId_gudangId: {
                barangId: existingRecord.barangId,
                gudangId: existingRecord.gudangId
              }
            }
          })
        } else {
          // Update stock back to system stock
          await tx.barangGudang.update({
            where: {
              barangId_gudangId: {
                barangId: existingRecord.barangId,
                gudangId: existingRecord.gudangId
              }
            },
            data: { stok: existingRecord.stokSistem }
          })
        }
      }

      // Delete the stock opname record
      await tx.stockOpname.delete({
        where: { id: id.trim() }
      })
    })

    return apiSuccess({
      message: 'Stock opname berhasil dihapus'
    })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan')
    console.error('Delete error:', err.message)

    if (err.message.includes('tidak ditemukan')) {
      return ApiErrors.notFound(err.message)
    }

    return ApiErrors.internalError(err.message || 'Gagal menghapus stock opname')
  }
}