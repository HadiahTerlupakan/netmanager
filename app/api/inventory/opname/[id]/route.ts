import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * GET /api/inventory/opname/[id]
 * Get single stock opname record by ID
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/opname/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Unpack params since it's a Promise in Next.js 16
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
        return NextResponse.json({ error: 'Record stock opname tidak ditemukan' }, { status: 404 })
      }

      logger.dbOperation('findUnique', 'StockOpname+Relations', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/opname/[id]', 200, Date.now() - startTime, {
        userId: session.user.id,
        opnameId: id,
      })

      return NextResponse.json(opnameRecord)
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching stock opname record', error, {
      path: '/api/inventory/opname/[id]',
      method: 'GET',
      id: 'unknown',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data stock opname' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/opname/[id]
 * Update stock opname record
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to PUT /api/inventory/opname/[id]')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Unpack params since it's a Promise in Next.js 16
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
      return NextResponse.json(
        { error: 'Stok fisik harus berupa angka non-negatif' },
        { status: 400 }
      )
    }

    // Validate condition breakdown
    if (kondisiBaik !== undefined && kondisiRusak !== undefined && kondisiExpire !== undefined) {
      const totalKondisi = kondisiBaik + kondisiRusak + kondisiExpire
      if (totalKondisi > stokFisik) {
        return NextResponse.json(
          { error: 'Total jumlah kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik' },
          { status: 400 }
        )
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
              barangId: existingRecord.barangId,
              gudangId: existingRecord.gudangId,
              stok: stokFisik
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

      return NextResponse.json({
        message: 'Stock opname berhasil diperbarui',
        record: result
      })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error updating stock opname', error, {
      path: '/api/inventory/opname/[id]',
      method: 'PUT',
      id: 'unknown',
    })

    if (error.message === 'Record stock opname tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Gagal memperbarui stock opname' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/opname/[id]
 * Delete stock opname record
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Unpack params since it's a Promise in Next.js 16
    const { id } = await params

    // Validate ID
    if (!id || id.trim() === '') {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
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

    return NextResponse.json({
      message: 'Stock opname berhasil dihapus'
    })
  } catch (error: any) {
    console.error('Delete error:', error.message)

    if (error.message.includes('tidak ditemukan')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: error.message || 'Gagal menghapus stock opname' },
      { status: 500 }
    )
  }
}